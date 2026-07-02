"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, Send, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { decryptField, isEncrypted } from "@/lib/secureKeys";
import { buildFallbackChain } from "@/lib/fallback";

/* Görüntü Stüdyosu — Qwen Studio benzeri sohbet akışı, ücretsiz & anahtarsız.
   Konuşarak görsel üret (Pollinations image, keyless): prompt yaz → asistan
   görselleri sohbete döner. Çoklu varyasyon (1/2/4), ücretsiz LLM ile prompt
   geliştirme, her görsel için yeniden varyasyon, indir/sil. Model + format
   korunur. URL doğrudan <img> ile yüklenir → API anahtarı gerekmez. */

const MODELS: { id: string; label: string }[] = [
  { id: "flux", label: "Flux — kaliteli" },
  { id: "turbo", label: "Turbo — hızlı" },
  { id: "flux-realism", label: "Realism — foto-gerçekçi" },
  { id: "flux-anime", label: "Anime — çizgi" },
  { id: "flux-3d", label: "3D — render" },
  { id: "any-dark", label: "Any Dark — sanatsal" },
];

const FORMATS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "Kare 1:1", w: 1024, h: 1024 },
  { id: "16:9", label: "Yatay 16:9", w: 1280, h: 720 },
  { id: "9:16", label: "Dikey 9:16", w: 720, h: 1280 },
  { id: "4:3", label: "Yatay 4:3", w: 1200, h: 900 },
  { id: "3:4", label: "Dikey 3:4", w: 900, h: 1200 },
  { id: "21:9", label: "Ultra 21:9", w: 1280, h: 548 },
];

const COUNTS = [1, 2, 4];

const STYLES = ["sinematik", "foto-gerçekçi", "minimal", "suluboya", "neon siberpunk", "izometrik 3B", "yağlı boya", "anime"];

const SUGGESTIONS = [
  "gün batımında sisli dağ manzarası, sinematik ışık, yüksek detay",
  "fütüristik bir şehir, neon ışıklar, yağmurlu gece, geniş açı",
  "minimalist amber tonlu soyut arka plan, yumuşak gradyan",
  "sevimli bir robot karakteri, izometrik 3B render, pastel renkler",
];

interface GenItem { id: string; url: string; w: number; h: number; loading: boolean; error: boolean; }
interface ImgMsg { id: string; role: "user" | "assistant"; text?: string; model?: string; items?: GenItem[]; }

async function usableApiKey(model: { apiKey?: string; provider: string }): Promise<string> {
  const cfg = useStore.getState().config;
  let k = model.apiKey || (cfg.providerKeys as Record<string, string> | undefined)?.[model.provider] || "";
  if (k) { k = await decryptField(k); if (isEncrypted(k)) k = ""; }
  return k;
}

function imgUrl(prompt: string, model: string, w: number, h: number, seed: number) {
  // enhance=true → Pollinations prompt'u zenginleştirir, daha kaliteli görsel verir.
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=${encodeURIComponent(model)}&seed=${seed}&nologo=true&enhance=true`;
}

export function ImageStudio() {
  const open = useStore((s) => s.imageStudioOpen);
  const setOpen = useStore((s) => s.setImageStudioOpen);
  const setDesignStudioOpen = useStore((s) => s.setDesignStudioOpen);
  const setStudioOpen = useStore((s) => s.setStudioOpen);
  const addToast = useStore((s) => s.addToast);
  const config = useStore((s) => s.config);

  /* Eklenen modeller arasından görüntü üretebilenler (BYOK). Kullanıcı kendi
     anahtarıyla bu sağlayıcının görüntü modelini Görüntü Stüdyosu'nda kullanır. */
  const userImgModels = useMemo(() => {
    const labels: Record<string, string> = { gemini: "Gemini (görüntü)", openai: "OpenAI (DALL·E)", xai: "xAI (Grok)", hf: "HF FLUX (açık kaynak)" };
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const m of config.models) {
      if (labels[m.provider] && !seen.has(m.provider)) { seen.add(m.provider); out.push({ id: `prov:${m.provider}`, label: labels[m.provider] }); }
    }
    return out;
  }, [config.models]);

  const keyForProvider = async (provider: string) => {
    const m = config.models.find((x) => x.provider === provider);
    return m ? usableApiKey(m) : "";
  };

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux");
  const [format, setFormat] = useState("1:1");
  const [count, setCount] = useState(1);
  const [msgs, setMsgs] = useState<ImgMsg[]>([]);
  const [enhancing, setEnhancing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  if (!open) return null;

  const runGenerate = (p: string, mdl: string, n: number) => {
    const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0];

    /* Eklenen model (BYOK) → /api/image üzerinden sağlayıcının görüntü modeli. */
    if (mdl.startsWith("prov:")) {
      const provider = mdl.slice(5);
      const items: GenItem[] = Array.from({ length: n }, (_, i) => ({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`, url: "", w: fmt.w, h: fmt.h, loading: true, error: false,
      }));
      setMsgs((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: "user", text: p, model: mdl },
        { id: `a_${Date.now()}`, role: "assistant", model: mdl, items },
      ]);
      void (async () => {
        const apiKey = await keyForProvider(provider);
        if (!apiKey) {
          items.forEach((it) => mark(it.id, { loading: false, error: true }));
          addToast(`${provider} için API anahtarı yok — Ayarlar → Modeller'den ekle.`, "error");
          return;
        }
        await Promise.all(items.map(async (it) => {
          try {
            const res = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider, apiKey, prompt: p, size: `${fmt.w}x${fmt.h}` }),
            });
            const j = await res.json() as { image?: string; error?: string };
            if (!res.ok || !j.image) throw new Error(j.error || `Hata ${res.status}`);
            mark(it.id, { url: j.image, loading: false });
          } catch (e) {
            mark(it.id, { loading: false, error: true });
            addToast(`Görüntü üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
          }
        }));
      })();
      return;
    }

    /* Pollinations (ücretsiz, anahtarsız) — doğrudan <img> URL'i. */
    const items: GenItem[] = Array.from({ length: n }, () => {
      const seed = Math.floor(Math.random() * 1_000_000);
      return { id: `${Date.now()}_${seed}`, url: imgUrl(p, mdl, fmt.w, fmt.h, seed), w: fmt.w, h: fmt.h, loading: true, error: false };
    });
    setMsgs((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text: p, model: mdl },
      { id: `a_${Date.now()}`, role: "assistant", model: mdl, items },
    ]);
  };

  const send = () => {
    const p = prompt.trim();
    if (!p) return;
    runGenerate(p, model, count);
    setPrompt("");
  };

  const mark = (id: string, patch: Partial<GenItem>) =>
    setMsgs((prev) => prev.map((m) => m.items ? { ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) } : m));

  const removeItem = (id: string) =>
    setMsgs((prev) => prev
      .map((m) => m.items ? { ...m, items: m.items.filter((it) => it.id !== id) } : m)
      .filter((m) => !(m.role === "assistant" && m.items && m.items.length === 0)));

  const downloadUrl = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `craft-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      window.open(url, "_blank");
      addToast("İndirme engellendi — yeni sekmede açıldı", "info");
    }
  };
  const download = (it: GenItem) => downloadUrl(it.url);

  /* Ücretsiz LLM ile prompt'u zengin betimleyici bir prompt'a geliştir (Qwen tarzı). */
  const enhance = async () => {
    const base = prompt.trim();
    if (!base || enhancing) return;
    setEnhancing(true);
    try {
      const cfg = useStore.getState().config;
      const active = useStore.getState().activeModel();
      if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
      const apiKey = await usableApiKey(active);
      const sys = "Sen bir görsel üretim prompt uzmanısın. Kullanıcının kısa fikrini, görüntü üreticiler (Flux/SD) için ZENGİN, betimleyici TEK bir prompt'a dönüştür: konu, kompozisyon, ışık, renk, stil, lens/detay ekle. SADECE prompt metnini döndür — açıklama, tırnak veya etiket yazma. Tek paragraf.";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: base }],
          baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider,
          systemPrompt: sys, fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
          tools: false, webSearch: false, temperature: 0.8,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);
      const reader = res.body.getReader(); const dec = new TextDecoder();
      let buf = ""; let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const ln of lines) {
          const t = ln.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; setPrompt(full.trim()); }
          } catch { /* yoksay */ }
        }
      }
      if (!full.trim()) addToast("Prompt geliştirilemedi — tekrar dene.", "error");
    } catch (e) {
      addToast(`Geliştirme hatası: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setEnhancing(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-modal-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Üst bar */}
      <div className="brand-rule glass shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3">
        <span className="w-8 h-8 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand shrink-0">
          <ImageIcon size={16} />
        </span>
        {/* Tek stüdyo, üç mod: Stüdyo (brief→AI) · Tuval · Görüntü (bu). */}
        <div className="flex items-center bg-bgsoft border border-line rounded-lg p-0.5 text-xs font-semibold shrink-0">
          <button onClick={() => { setOpen(false); setStudioOpen(true); }} className="px-2.5 py-1 rounded-md text-muted hover:text-ink transition-colors" title="Brief ile AI tasarım (web · sunum · yayınla)">Stüdyo</button>
          <button onClick={() => { setOpen(false); setDesignStudioOpen(true); }} className="px-2.5 py-1 rounded-md text-muted hover:text-ink transition-colors" title="Katman/tuval editörü (slayt · afiş · sosyal)">Tuval</button>
          <button className="px-2.5 py-1 rounded-md bg-brand/15 text-brand">Görüntü</button>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-brand/40 text-xs font-semibold transition-colors">
            <Trash2 size={13} /> Temizle
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className={`${msgs.length > 0 ? "" : "ml-auto"} w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors`}
          title="Kapat"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sohbet akışı */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {msgs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted/55 select-none pt-12">
              <Sparkles size={30} className="text-brand/40 mb-3" />
              <p className="text-sm mb-5">Ne görmek istediğini yaz, asistan senin için üretsin.</p>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setPrompt(s)} className="text-left text-[12.5px] leading-snug px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
                ))}
              </div>
            </div>
          ) : msgs.map((m) => (
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed bg-brand/15 border border-brand/25 text-ink whitespace-pre-wrap">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-2">
                <div className="text-[11px] text-muted/45 flex items-center gap-1.5"><Sparkles size={11} className="text-brand" /> {MODELS.find((x) => x.id === m.model)?.label ?? m.model}</div>
                <div className={`grid gap-3 ${(m.items?.length ?? 1) > 1 ? "grid-cols-2" : "grid-cols-1 max-w-md"}`}>
                  {m.items?.map((it) => (
                    <div key={it.id} className="premium-card rounded-2xl overflow-hidden group/img">
                      <div className="relative bg-bgsoft" style={{ aspectRatio: `${it.w} / ${it.h}` }}>
                        {it.loading && <div className="absolute inset-0 grid place-items-center text-muted/60"><Loader2 size={22} className="animate-spin text-brand" /></div>}
                        {it.error ? (
                          <div className="absolute inset-0 grid place-items-center text-xs text-red/80 px-3 text-center">Üretilemedi — tekrar dene</div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.url}
                            alt=""
                            onClick={() => { if (!it.loading) setLightbox(it.url); }}
                            className={`w-full h-full object-cover cursor-zoom-in transition-opacity ${it.loading ? "opacity-0" : "opacity-100"}`}
                            onLoad={() => mark(it.id, { loading: false })}
                            onError={() => mark(it.id, { loading: false, error: true })}
                          />
                        )}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          {!it.loading && !it.error && (
                            <>
                              <button onClick={() => download(it)} className="w-8 h-8 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/80 hover:text-brand" title="İndir"><Download size={14} /></button>
                              <button onClick={() => runGenerate(m.text ?? "", m.model ?? model, 1)} className="w-8 h-8 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/80 hover:text-brand" title="Varyasyon üret"><Wand2 size={14} /></button>
                            </>
                          )}
                          <button onClick={() => removeItem(it.id)} className="w-8 h-8 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/80 hover:text-red" title="Sil"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Alt besteci (composer) */}
      <div className="shrink-0 border-t border-line/60 bg-surface/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          {/* Stil çipleri */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {STYLES.map((st) => (
              <button key={st} onClick={() => setPrompt((p) => p ? `${p}, ${st}` : st)} className="shrink-0 px-2.5 py-1 rounded-full border border-line/60 hover:border-brand/50 text-[11px] text-muted hover:text-ink transition-colors">+ {st}</button>
            ))}
          </div>

          <div className="flex items-end gap-2 bg-bgsoft border border-line rounded-2xl px-3 py-2 focus-within:border-brand/50 transition-colors">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Bir görsel tarifle… (Enter ile üret, Shift+Enter satır)"
              rows={1}
              className="flex-1 bg-transparent text-sm outline-none resize-none max-h-32 py-1.5"
            />
            <button
              onClick={enhance}
              disabled={!prompt.trim() || enhancing}
              title="Prompt'u AI ile geliştir"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-xl border border-line text-muted hover:text-brand hover:border-brand/50 disabled:opacity-40 transition-colors"
            >
              {enhancing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            </button>
            <button
              onClick={send}
              disabled={!prompt.trim()}
              className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-brand text-white disabled:opacity-40 transition-opacity"
              title="Üret"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Seçenekler: model · format · adet */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand/50 cursor-pointer">
              <optgroup label="Ücretsiz (Pollinations)">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
              {userImgModels.length > 0 && (
                <optgroup label="Eklediğin modeller (kendi anahtarın)">
                  {userImgModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              )}
            </select>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand/50 cursor-pointer">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <div className="flex items-center gap-0.5 bg-bgsoft border border-line rounded-lg p-0.5">
              {COUNTS.map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${count === n ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>{n}×</button>
              ))}
            </div>
            <span className="text-[11px] text-muted/45 ml-auto hidden sm:block">Ücretsiz · anahtar gerekmez</span>
          </div>
        </div>
      </div>

      {/* Lightbox — görsele tıklayınca tam ekran foto */}
      {lightbox && (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-bg" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"><X size={18} /></button>
          <button onClick={(e) => { e.stopPropagation(); void downloadUrl(lightbox); }} className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"><Download size={15} /> İndir</button>
        </div>
      )}
    </div>
  );
}
