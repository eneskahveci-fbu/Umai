"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen, FolderOpen, Globe, Link2, Loader2, Plus, Save, Send,
  Sparkles, Trash2, Volume2, VolumeX,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { StudioTopBar } from "./StudioTopBar";
import { SavedItemsModal } from "./SavedItemsModal";
import type { CraftNotebook, NotebookSource } from "@/lib/types";
import { streamChat } from "@/lib/genChat";
import { playTts, stopTts, TTS_MAX_CHARS, TTS_VOICES } from "@/lib/pollinations";

/* Defter — NotebookLM'den İLHAM alan craft yorumu (klonu değil): metin/URL
   kaynakları ekle → yalnız o kaynaklardan yanıtlayan sohbet ([1] [2] atıflı)
   → Pollinations TTS ile "sesli özet". URL'ler mevcut /api/fetch-text
   proxy'sinden çekilir (SSRF korumalı). Ücretsiz ve anahtarsız çalışır. */

const MAX_SOURCES = 8;
const PER_SOURCE_CHARS = 8000;
const TOTAL_CONTEXT_CHARS = 24000;

interface NbMsg { role: "user" | "assistant"; content: string; }

function newSourceId(): string {
  return `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Sohbet sistem promptu: kaynaklara SADIK kal, [n] ile atıf ver. */
export function buildNotebookSystem(sources: NotebookSource[]): string {
  const on = sources.filter((s) => s.enabled && s.text.trim());
  let budget = TOTAL_CONTEXT_CHARS;
  const parts: string[] = [];
  on.forEach((s, i) => {
    const take = Math.min(PER_SOURCE_CHARS, budget);
    if (take <= 0) return;
    const text = s.text.slice(0, take);
    budget -= text.length;
    parts.push(`[${i + 1}] ${s.name}\n${text}`);
  });
  return (
    "Sen kaynak-temelli bir araştırma asistanısın. YALNIZCA aşağıdaki KAYNAKLARDAN yanıt ver; " +
    "kaynaklarda olmayan bilgiyi EKLEME, bilmiyorsan 'kaynaklarda yok' de. " +
    "Her iddianın sonuna köşeli parantezle kaynak numarası koy (ör. [1], [2]). " +
    "Türkçe, net ve öz yanıtla.\n\n=== KAYNAKLAR ===\n\n" + parts.join("\n\n---\n\n")
  );
}

export function NotebookStudio({ embedded }: { embedded?: boolean } = {}) {
  const open = useStore((s) => s.notebookStudioOpen);
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const [nbId, setNbId] = useState<string>(() => `nb_${Date.now().toString(36)}`);
  const [title, setTitle] = useState("Yeni defter");
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [msgs, setMsgs] = useState<NbMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [srcPanel, setSrcPanel] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  useEffect(() => () => { stopTts(); abortRef.current?.abort(); }, []);

  if (!open) return null;

  const enabledCount = sources.filter((s) => s.enabled && s.text.trim()).length;

  const addPaste = () => {
    const t = pasteText.trim();
    if (!t) return;
    if (sources.length >= MAX_SOURCES) { addToast(`En fazla ${MAX_SOURCES} kaynak.`, "info"); return; }
    const name = t.split("\n")[0].slice(0, 48) || "Yapıştırılan metin";
    setSources((s) => [...s, { id: newSourceId(), name, text: t, enabled: true }]);
    setPasteText("");
  };

  const addUrl = async () => {
    const u = urlInput.trim();
    if (!u || fetching) return;
    if (sources.length >= MAX_SOURCES) { addToast(`En fazla ${MAX_SOURCES} kaynak.`, "info"); return; }
    setFetching(true);
    try {
      const res = await fetch(`/api/fetch-text?url=${encodeURIComponent(u)}`);
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error || `Hata ${res.status}`);
      const name = u.replace(/^https?:\/\//, "").slice(0, 48);
      setSources((s) => [...s, { id: newSourceId(), name, text: data.text!, url: u, enabled: true }]);
      setUrlInput("");
    } catch (e) {
      addToast(`URL getirilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setFetching(false); }
  };

  const ask = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    if (!enabledCount) { addToast("Önce en az bir kaynak ekle.", "info"); return; }
    setInput("");
    setBusy(true);
    const history: NbMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      await streamChat({
        system: buildNotebookSystem(sources),
        messages: history,
        temperature: 0.3,
        signal: ac.signal,
        onDelta: (full) => setMsgs([...history, { role: "assistant", content: full }]),
      });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setMsgs([...history, { role: "assistant", content: `Hata: ${e instanceof Error ? e.message : "bilinmeyen"}` }]);
      }
    } finally { setBusy(false); abortRef.current = null; }
  };

  /* Sesli özet — NotebookLM'in "audio overview" fikrinin craft yorumu:
     kaynaklardan kısa sohbet-tarzı özet üret, Pollinations TTS ile oku. */
  const audioSummary = async () => {
    if (speaking) { stopTts(); setSpeaking(false); return; }
    if (!enabledCount) { addToast("Önce en az bir kaynak ekle.", "info"); return; }
    if (busy) return;
    setBusy(true);
    const history: NbMsg[] = [...msgs, { role: "user", content: "🔊 Sesli özet istendi" }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    try {
      const text = await streamChat({
        system: buildNotebookSystem(sources),
        messages: [{ role: "user", content: `Kaynakların ana fikirlerini sıcak, sohbet tarzında ve EN FAZLA ${Math.floor(TTS_MAX_CHARS * 0.9)} karakterde özetle — sesli dinleme için yazıyorsun; madde işareti ve atıf numarası kullanma, akıcı konuş.` }],
        temperature: 0.6,
        onDelta: (full) => setMsgs([...history, { role: "assistant", content: full }]),
      });
      if (text.trim()) {
        setSpeaking(true);
        playTts(text, config.ttsVoice || "nova", () => setSpeaking(false));
      }
    } catch (e) {
      addToast(`Özet üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setBusy(false); }
  };

  const saveNb = () => {
    const nb: CraftNotebook = {
      id: nbId, title: title.trim() || "Defter", sources,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const existing = config.craftNotebooks ?? [];
    const prev = existing.find((n) => n.id === nbId);
    if (prev) nb.createdAt = prev.createdAt;
    saveConfig({ ...config, craftNotebooks: [nb, ...existing.filter((n) => n.id !== nbId)].slice(0, 20) });
    addToast("Defter kaydedildi.", "success");
  };

  const openNb = (n: CraftNotebook) => {
    stopTts(); setSpeaking(false);
    setNbId(n.id); setTitle(n.title); setSources(n.sources); setMsgs([]); setSavedOpen(false);
  };
  const removeNb = (id: string) =>
    saveConfig({ ...config, craftNotebooks: (config.craftNotebooks ?? []).filter((n) => n.id !== id) });

  const newNb = () => {
    stopTts(); setSpeaking(false);
    setNbId(`nb_${Date.now().toString(36)}`); setTitle("Yeni defter"); setSources([]); setMsgs([]);
  };

  const saved = config.craftNotebooks ?? [];

  const slimActionsRow = (
    <div className="h-10 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line/60">
      <button onClick={newNb} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink shrink-0">+ Yeni</button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Defter adı"
        className="ml-auto hidden md:block w-40 bg-transparent text-xs text-muted focus:text-ink border-b border-transparent focus:border-line outline-none px-1 py-0.5"
      />
      <div className="flex items-center gap-1 shrink-0">
        {saved.length > 0 && (
          <button onClick={() => setSavedOpen(true)} title="Kayıtlı defterler" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
        )}
        <button onClick={saveNb} title="Defteri kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
      </div>
    </div>
  );

  const content = (
    <>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Kaynak paneli */}
        <div className={`shrink-0 lg:w-80 border-b lg:border-b-0 lg:border-r border-line/60 overflow-y-auto ${srcPanel ? "" : "hidden lg:block"}`}>
          <div className="p-3 space-y-3">
            <div className="text-[11px] font-bold text-muted/70 uppercase tracking-wide">Kaynaklar ({sources.length}/{MAX_SOURCES})</div>
            {sources.map((s, i) => (
              <div key={s.id} className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border transition-colors ${s.enabled ? "border-line/60" : "border-line/30 opacity-50"}`}>
                <input type="checkbox" checked={s.enabled} onChange={(e) => setSources((arr) => arr.map((x) => x.id === s.id ? { ...x, enabled: e.target.checked } : x))} className="mt-0.5 shrink-0" title="Sohbete dahil et" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate flex items-center gap-1">
                    <span className="text-brand">[{i + 1}]</span>
                    {s.url && <Link2 size={10} className="text-muted/50 shrink-0" />}
                    <span className="truncate">{s.name}</span>
                  </div>
                  <div className="text-[10px] text-muted/50">{s.text.length.toLocaleString("tr-TR")} karakter</div>
                </div>
                <button onClick={() => setSources((arr) => arr.filter((x) => x.id !== s.id))} className="w-6 h-6 grid place-items-center rounded text-muted/40 hover:text-red shrink-0" title="Kaldır"><Trash2 size={12} /></button>
              </div>
            ))}

            {/* Kaynak ekleme */}
            <div className="rounded-xl border border-dashed border-line/60 p-2.5 space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={3}
                placeholder="Metin yapıştır (not, makale, transkript…)"
                className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 resize-none"
              />
              <button onClick={addPaste} disabled={!pasteText.trim()} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand/15 text-brand text-xs font-semibold hover:bg-brand/25 disabled:opacity-40 transition-colors">
                <Plus size={13} /> Metni kaynak ekle
              </button>
              <div className="flex gap-1.5">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void addUrl(); }}
                  placeholder="https://… (URL'den getir)"
                  className="flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50"
                />
                <button onClick={() => void addUrl()} disabled={fetching || !urlInput.trim()} className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-line text-muted hover:text-brand hover:border-brand/50 disabled:opacity-40 transition-colors" title="URL içeriğini getir">
                  {fetching ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                </button>
              </div>
            </div>

            {/* Sesli özet */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => void audioSummary()} disabled={busy && !speaking} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${speaking ? "border-brand/50 text-brand bg-brand/10" : "border-line text-muted hover:text-ink hover:border-brand/40"} disabled:opacity-40`}>
                {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />} {speaking ? "Durdur" : "Sesli özet"}
              </button>
              <select
                value={config.ttsVoice || "nova"}
                onChange={(e) => saveConfig({ ...config, ttsVoice: e.target.value })}
                className="bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50 cursor-pointer"
                aria-label="Seslendirme sesi"
              >
                {TTS_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Sohbet */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <button onClick={() => setSrcPanel((v) => !v)} className="lg:hidden shrink-0 text-[11px] text-muted/60 py-1.5 border-b border-line/40">
            {srcPanel ? "▲ Kaynakları gizle" : `▼ Kaynaklar (${sources.length})`}
          </button>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
              {msgs.length === 0 ? (
                <div className="text-center text-muted/55 select-none pt-16">
                  <BookOpen size={30} className="text-brand/40 mx-auto mb-3" />
                  <p className="text-sm text-balance">
                    {enabledCount
                      ? "Kaynakların hazır — soru sor, yalnız kaynaklardan [1] [2] atıflı yanıt alırsın."
                      : "Soldan metin yapıştır ya da URL getir; sonra kaynaklara sadık sohbet başlasın."}
                  </p>
                </div>
              ) : msgs.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed bg-brand/15 border border-brand/25 text-ink whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <Sparkles size={13} className="text-brand mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {m.content || <Loader2 size={14} className="animate-spin text-brand" />}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t border-line/60 bg-surface/40">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
                rows={1}
                placeholder={enabledCount ? "Kaynaklara soru sor… (Enter = gönder)" : "Önce kaynak ekle…"}
                className="flex-1 bg-bgsoft border border-line rounded-2xl px-3.5 py-2.5 text-sm outline-none focus:border-brand/50 resize-none max-h-32"
              />
              <button onClick={() => void ask()} disabled={busy || !input.trim() || !enabledCount} className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand text-[#111110] disabled:opacity-40 transition-opacity" title="Gönder">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kayıtlı defterler */}
      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Kayıtlı defterler"
        icon={BookOpen}
        items={saved}
        getKey={(n) => n.id}
        renderRow={(n) => (
          <>
            <div className="text-sm font-semibold truncate">{n.title}</div>
            <div className="text-[11px] text-muted/60">{n.sources.length} kaynak · {new Date(n.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openNb}
        onDelete={(n) => removeNb(n.id)}
        emptyLabel="Henüz kayıtlı defter yok."
      />
    </>
  );

  if (embedded) {
    return (
      <>
        {slimActionsRow}
        {content}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Üst bar */}
      <StudioTopBar
        icon={BookOpen}
        label="Defter"
        activeSurface="notebook"
        showWorkActions
        onNew={newNb}
        onClose={() => nav.close()}
        title={{ value: title, onChange: setTitle, placeholder: "Defter adı" }}
        actions={
          <>
            {saved.length > 0 && (
              <button onClick={() => setSavedOpen(true)} title="Kayıtlı defterler" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
            )}
            <button onClick={saveNb} title="Defteri kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
          </>
        }
      />
      {content}
    </div>
  );
}
