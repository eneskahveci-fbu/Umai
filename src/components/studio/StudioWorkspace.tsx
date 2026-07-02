"use client";

import { useState } from "react";
import { Download, ExternalLink, FileText, FolderOpen, History, Link2, Loader2, Save, Send, Shuffle, SlidersHorizontal, Sparkles, Square, User } from "lucide-react";
import { STUDIO_DEVICES, type StudioDevice, type DeviceId } from "@/lib/studioConstants";
import type { StudioPhase } from "@/lib/studioGen";
import { downloadHtml, openInTab, printPdf } from "@/lib/studioExport";
import { useStore } from "@/lib/store";
import { DeviceFrame } from "./DeviceFrame";
import type { StudioMsg, StudioTweaks } from "./StudioView";

const PHASE_LABEL: Record<StudioPhase, string> = {
  planning: "Planlanıyor…",
  generating: "Tasarım üretiliyor…",
  rendering: "Önizleme hazırlanıyor…",
  done: "Hazır",
  error: "Hata",
};

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Varsayılan", value: "" },
  { label: "Sistem", value: "system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Yuvarlak", value: "'Trebuchet MS', sans-serif" },
];

export function StudioWorkspace({
  messages, busy, phase, artifact, effectiveSrc, device, setDevice, reloadKey,
  tweaks, setTweaks, resetTweaks, title, onFollowup, onStop, onSave, onOpenProjects, animate, setAnimate, onVariations, onPublish,
  versions, onRestoreVersion,
}: {
  messages: StudioMsg[];
  busy: boolean;
  phase: StudioPhase | null;
  artifact: { type: string; content: string } | null;
  effectiveSrc: string;
  device: StudioDevice;
  setDevice: (d: DeviceId) => void;
  reloadKey: number;
  tweaks: StudioTweaks;
  setTweaks: (t: StudioTweaks) => void;
  resetTweaks: () => void;
  title: string;
  onFollowup: (t: string) => void;
  onStop: () => void;
  onSave: () => void;
  onOpenProjects: () => void;
  animate: boolean;
  setAnimate: (b: boolean) => void;
  onVariations: () => void;
  onPublish: () => void;
  /** Kaydedilmiş önceki üretimler (yeniden eskiye) — "Geçmiş" menüsü. */
  versions?: string[];
  onRestoreVersion?: (html: string) => void;
}) {
  const addToast = useStore((s) => s.addToast);
  const [input, setInput] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(true);

  const submit = () => { const t = input.trim(); if (!t || busy) return; setInput(""); onFollowup(t); };
  const exportAs = (fn: () => boolean | void, okMsg?: string) => {
    setExportOpen(false);
    if (!artifact) return;
    const r = fn();
    if (r === false) addToast("Açılır pencere engellendi — izin ver.", "error");
    else if (okMsg) addToast(okMsg, "success");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* SOL — ajan akış paneli */}
      <aside className="w-full md:w-80 lg:w-96 shrink-0 border-b md:border-b-0 md:border-r border-line flex flex-col min-h-0 max-h-[38vh] md:max-h-none">
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-2.5 text-sm">
              <div className="shrink-0 w-6 h-6 rounded-full grid place-items-center mt-0.5 border border-line bg-bgsoft">
                {m.role === "user" ? <User size={12} className="text-muted" /> : <Sparkles size={12} className="text-brand" />}
              </div>
              <div className="flex-1 min-w-0 whitespace-pre-wrap break-words leading-relaxed text-ink/90">
                {m.text || <span className="text-muted/60">…</span>}
              </div>
            </div>
          ))}
          {busy && phase && (
            <div className="flex items-center gap-2 text-xs text-brand pl-8">
              <Loader2 size={12} className="animate-spin" /> {PHASE_LABEL[phase]}
            </div>
          )}
        </div>
        {/* Takip / değişiklik girişi */}
        <div className="shrink-0 border-t border-line p-2.5">
          <div className="flex items-end gap-1.5 rounded-xl border border-line bg-surface focus-within:border-brand/50 px-2 py-1.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder="Değişiklik iste (ör. 'CTA'yı yeşil yap, fiyat ekle')…"
              className="flex-1 bg-transparent resize-none outline-none text-sm py-1 max-h-28"
            />
            {busy ? (
              <button onClick={onStop} className="shrink-0 p-1.5 rounded-lg text-muted hover:text-red" title="Durdur"><Square size={15} /></button>
            ) : (
              <button onClick={submit} disabled={!input.trim()} className="shrink-0 p-1.5 rounded-lg text-brand disabled:opacity-30 hover:bg-brand/10" title="Gönder"><Send size={15} /></button>
            )}
          </div>
        </div>
      </aside>

      {/* ORTA — cihaz çerçeveli önizleme + üst kontroller */}
      <main className="flex-1 min-h-0 flex flex-col bg-bgsoft/30">
        <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
          {/* Cihaz seçici */}
          <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-xs">
            {STUDIO_DEVICES.map((d) => (
              <button key={d.id} onClick={() => setDevice(d.id)} className={`px-2.5 py-1 rounded-md transition-colors ${device.id === d.id ? "bg-brand/15 text-brand font-semibold" : "text-muted hover:text-ink"}`}>{d.name}</button>
            ))}
          </div>
          <button
            onClick={() => {
              const next = !animate;
              setAnimate(next);
              addToast(next ? "Animasyon açık — bir sonraki üretimde/değişiklikte uygulanır." : "Animasyon kapalı.", "info");
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${animate ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}
            title="Animasyon: sonraki üretimde CSS animasyonları ekle"
          ><Sparkles size={12} /> Animasyon</button>
          <div className="ml-auto flex items-center gap-1">
            {/* Sürüm geçmişi — kaydedilen önceki üretimlere dönüş */}
            {(versions?.length ?? 0) > 0 && (
              <div className="relative">
                <button onClick={() => setHistoryOpen((v) => !v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${historyOpen ? "border-brand/50 text-brand" : "border-line text-muted hover:text-ink"}`} title="Sürüm geçmişi — önceki üretimlere dön">
                  <History size={13} /> Geçmiş
                </button>
                {historyOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setHistoryOpen(false)} />
                    <div className="absolute right-0 mt-1.5 z-20 w-56 bg-surface border border-line rounded-xl shadow-2xl p-1 text-xs">
                      {(versions ?? []).map((h, i) => (
                        <button key={i} onClick={() => { setHistoryOpen(false); onRestoreVersion?.(h); }} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left">
                          <span>{i + 1} önceki sürüm</span>
                          <span className="text-[10px] font-mono text-muted/50">{Math.max(1, Math.round(h.length / 1024))} KB</span>
                        </button>
                      ))}
                      <p className="px-2.5 pt-1 pb-0.5 text-[10px] text-muted/50">Dönüş, Kaydet ile kalıcı olur.</p>
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={onVariations} disabled={!artifact} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-line text-muted hover:text-ink disabled:opacity-40" title="Farklı yönlerde varyasyon üret"><Shuffle size={13} /> Varyant</button>
            <button onClick={onOpenProjects} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors" title="Projelerim"><FolderOpen size={15} /></button>
            <button onClick={onSave} disabled={!artifact} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-line text-muted hover:text-ink disabled:opacity-40" title="Projeyi kaydet"><Save size={13} /> Kaydet</button>
            <button onClick={() => setTweaksOpen((v) => !v)} className={`p-1.5 rounded-lg transition-colors ${tweaksOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`} title="İnce ayar"><SlidersHorizontal size={15} /></button>
            <div className="relative">
              <button onClick={() => setExportOpen((v) => !v)} disabled={!artifact} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-line text-muted hover:text-ink disabled:opacity-40" title="Dışa aktar"><Download size={13} /> Dışa aktar</button>
              {exportOpen && artifact && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-line rounded-xl shadow-xl p-1 z-20 text-sm">
                  <button onClick={() => exportAs(() => downloadHtml(effectiveSrc, title))} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft text-left"><Download size={14} className="text-brand" /> HTML indir</button>
                  <button onClick={() => exportAs(() => printPdf(effectiveSrc))} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft text-left"><FileText size={14} className="text-brand" /> PDF (yazdır)</button>
                  <button onClick={() => exportAs(() => openInTab(effectiveSrc))} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft text-left"><ExternalLink size={14} className="text-brand" /> Yeni sekmede aç</button>
                  <div className="h-px bg-line my-1" />
                  <button onClick={() => { setExportOpen(false); onPublish(); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft text-left"><Link2 size={14} className="text-brand" /> Yayınla (link)</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {artifact ? (
            <DeviceFrame srcDoc={effectiveSrc} device={device} reloadKey={reloadKey} />
          ) : busy ? (
            /* İskelet önizleme — boş spinner yerine "sayfa doluyor" hissi. */
            <div className="h-full p-6 sm:p-10 overflow-hidden">
              <div className="max-w-2xl mx-auto h-full rounded-2xl border border-line bg-surface p-6 sm:p-8 animate-pulse space-y-5">
                <div className="h-3 w-24 rounded bg-line/70" />
                <div className="h-8 w-3/4 rounded-lg bg-line/80" />
                <div className="h-3.5 w-1/2 rounded bg-line/60" />
                <div className="h-9 w-32 rounded-xl bg-brand/25" />
                <div className="grid grid-cols-3 gap-3 pt-3">
                  <div className="h-20 rounded-xl bg-line/50" />
                  <div className="h-20 rounded-xl bg-line/50" />
                  <div className="h-20 rounded-xl bg-line/50" />
                </div>
                <div className="h-3 w-full rounded bg-line/50" />
                <div className="h-3 w-5/6 rounded bg-line/50" />
                <p className="text-xs text-muted/60 flex items-center gap-1.5 pt-1">
                  <Loader2 size={12} className="animate-spin text-brand" /> Tasarım üretiliyor…
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full grid place-items-center text-center px-6">
              <p className="text-sm text-muted">Henüz önizleme yok.</p>
            </div>
          )}
        </div>
      </main>

      {/* SAĞ — tweaks paneli */}
      {tweaksOpen && (
        <aside className="hidden lg:flex w-64 shrink-0 border-l border-line flex-col min-h-0">
          <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-line text-xs font-semibold">
            <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} className="text-brand" /> İnce ayar</span>
            <button onClick={resetTweaks} className="text-muted hover:text-ink font-normal">Sıfırla</button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-4 text-xs">
            <label className="block">
              <span className="text-muted block mb-1.5">Yazı ölçeği · {tweaks.fontScale.toFixed(2)}×</span>
              <input type="range" min={0.85} max={1.25} step={0.01} value={tweaks.fontScale}
                onChange={(e) => setTweaks({ ...tweaks, fontScale: Number(e.target.value) })}
                className="w-full accent-brand" />
            </label>
            <label className="block">
              <span className="text-muted block mb-1.5">Yazı tipi</span>
              <select value={tweaks.fontFamily} onChange={(e) => setTweaks({ ...tweaks, fontFamily: e.target.value })}
                className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 outline-none focus:border-brand">
                {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-muted block mb-1.5">Vurgu rengi <span className="text-muted/50">(değişken kullanan tasarımlarda)</span></span>
              <div className="flex items-center gap-2">
                <input type="color" value={tweaks.accent || "#c8a87e"} onChange={(e) => setTweaks({ ...tweaks, accent: e.target.value })}
                  className="w-8 h-8 rounded border border-line bg-transparent cursor-pointer" />
                {tweaks.accent && <button onClick={() => setTweaks({ ...tweaks, accent: "" })} className="text-muted hover:text-ink">Kaldır</button>}
              </div>
            </label>
            <p className="text-[10px] text-muted/50 leading-relaxed pt-1 border-t border-line/50">
              İnce ayarlar üretilen tasarıma anlık uygulanır (yeniden üretmeden). Yapısal değişiklik için soldan “Değişiklik iste”.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
