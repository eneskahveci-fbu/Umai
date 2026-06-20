"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { useStore } from "@/lib/store";

/* Görüntü Stüdyosu — ücretsiz, anahtarsız görüntü üretimi (Pollinations image).
   Ayrı tam-ekran panel (sohbetten bağımsız). Model + format seçilir; sonuçlar
   galeriye eklenir, indirilebilir. URL doğrudan <img> ile yüklenir → API anahtarı
   gerekmez. Qwen Studio benzeri bir "platform" akışı. */

const MODELS: { id: string; label: string }[] = [
  { id: "flux", label: "Flux — kaliteli (varsayılan)" },
  { id: "turbo", label: "Turbo — hızlı" },
  { id: "flux-realism", label: "Flux Realism — foto-gerçekçi" },
  { id: "flux-anime", label: "Flux Anime — anime/çizgi" },
  { id: "flux-3d", label: "Flux 3D — 3B render" },
  { id: "any-dark", label: "Any Dark — koyu/sanatsal" },
];

const FORMATS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "Kare 1:1", w: 1024, h: 1024 },
  { id: "16:9", label: "Yatay 16:9", w: 1280, h: 720 },
  { id: "9:16", label: "Dikey 9:16 (story)", w: 720, h: 1280 },
  { id: "4:3", label: "Yatay 4:3", w: 1200, h: 900 },
  { id: "3:4", label: "Dikey 3:4", w: 900, h: 1200 },
  { id: "21:9", label: "Ultra geniş 21:9", w: 1280, h: 548 },
];

interface GenItem {
  id: string;
  prompt: string;
  url: string;
  w: number;
  h: number;
  loading: boolean;
  error: boolean;
}

export function ImageStudio() {
  const open = useStore((s) => s.imageStudioOpen);
  const setOpen = useStore((s) => s.setImageStudioOpen);
  const addToast = useStore((s) => s.addToast);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux");
  const [format, setFormat] = useState("1:1");
  const [items, setItems] = useState<GenItem[]>([]);

  if (!open) return null;

  const generate = () => {
    const p = prompt.trim();
    if (!p) return;
    const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
    const seed = Math.floor(Math.random() * 1_000_000);
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}` +
      `?width=${fmt.w}&height=${fmt.h}&model=${encodeURIComponent(model)}&seed=${seed}&nologo=true`;
    const id = `${Date.now()}_${seed}`;
    setItems((prev) => [{ id, prompt: p, url, w: fmt.w, h: fmt.h, loading: true, error: false }, ...prev]);
  };

  const mark = (id: string, patch: Partial<GenItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const download = async (it: GenItem) => {
    try {
      const res = await fetch(it.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `craft-${it.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      window.open(it.url, "_blank");
      addToast("İndirme engellendi — yeni sekmede açıldı", "info");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-modal-bg">
      {/* Üst bar */}
      <div className="brand-rule glass shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3">
        <span className="w-8 h-8 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand">
          <ImageIcon size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">Görüntü Stüdyosu</div>
          <div className="text-[11px] text-muted/60 leading-tight">Ücretsiz · anahtar gerekmez (Pollinations)</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors"
          title="Kapat"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Sol: kontrol paneli */}
        <div className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-line/60 p-4 sm:p-5 overflow-y-auto bg-surface/30">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted/50 mb-1.5">Açıklama (prompt)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder="Örn: gün batımında dağ manzarası, sinematik, yüksek detay"
            rows={4}
            className="w-full bg-bgsoft border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand/50 resize-none mb-4"
          />

          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted/50 mb-1.5">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-bgsoft border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand/50 mb-4 cursor-pointer"
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted/50 mb-1.5">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full bg-bgsoft border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand/50 mb-5 cursor-pointer"
          >
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.w}×{f.h}</option>)}
          </select>

          <button
            onClick={generate}
            disabled={!prompt.trim()}
            className="btn-brand-glow w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <Wand2 size={16} /> Görüntü oluştur
          </button>
          <p className="text-[11px] text-muted/45 mt-3 leading-relaxed">
            ⌘/Ctrl + Enter ile de üretebilirsin. Video üretimi şimdilik ayrı (ücretsiz keyless video kaynağı sınırlı) — istersen ekleriz.
          </p>
        </div>

        {/* Sağ: galeri */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted/50 select-none">
              <Sparkles size={28} className="text-brand/40 mb-3" />
              <p className="text-sm">Soldan bir açıklama yaz, model + format seç, <strong className="text-muted/70">oluştur</strong>.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => (
                <div key={it.id} className="premium-card rounded-2xl overflow-hidden group/img">
                  <div className="relative bg-bgsoft" style={{ aspectRatio: `${it.w} / ${it.h}` }}>
                    {it.loading && (
                      <div className="absolute inset-0 grid place-items-center text-muted/60">
                        <Loader2 size={22} className="animate-spin text-brand" />
                      </div>
                    )}
                    {it.error ? (
                      <div className="absolute inset-0 grid place-items-center text-xs text-red/80 px-3 text-center">
                        Üretilemedi — tekrar dene
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.url}
                        alt={it.prompt}
                        className={`w-full h-full object-cover transition-opacity ${it.loading ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => mark(it.id, { loading: false })}
                        onError={() => mark(it.id, { loading: false, error: true })}
                      />
                    )}
                    {!it.loading && !it.error && (
                      <button
                        onClick={() => download(it)}
                        className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/80 hover:text-brand opacity-0 group-hover/img:opacity-100 transition-opacity"
                        title="İndir"
                      >
                        <Download size={14} />
                      </button>
                    )}
                  </div>
                  <p className="px-3 py-2 text-[11px] text-muted/60 line-clamp-2 leading-snug">{it.prompt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
