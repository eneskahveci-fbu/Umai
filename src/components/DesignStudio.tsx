"use client";

import { useState } from "react";
import { Code2, LayoutGrid, Play, Plus, Save, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { SavedDesign } from "@/lib/types";

/* Tasarım Stüdyosu — Claude Artifacts'tan ilham, craft teması. İki mod birlikte:
   (1) Canlı UI önizleme: HTML/CSS/JS yaz/yapıştır → sağda iframe'de anında render.
   (2) Galeri/board: tasarımları kaydet (kişiye özel, user_config ile senkron),
       tekrar aç, sil. Sohbette üretilen tasarımı buraya yapıştırıp önizleyip
       kaydedebilirsin. */

const STARTER = `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#111110;color:#f0ebe0;
       display:grid;place-items:center;min-height:100vh}
  .card{padding:40px 48px;border:1px solid #2e2a24;border-radius:20px;
        background:linear-gradient(160deg,#1b1a17,#181714);text-align:center}
  h1{margin:0 0 8px;color:#c8a87e}
  p{margin:0;color:#9a9080}
</style></head>
<body>
  <div class="card"><h1>Merhaba 👋</h1><p>Kodu düzenle, ▶ Çalıştır'a bas, beğenince kaydet.</p></div>
</body></html>`;

export function DesignStudio() {
  const open = useStore((s) => s.designStudioOpen);
  const setOpen = useStore((s) => s.setDesignStudioOpen);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const saved: SavedDesign[] = config.savedDesigns ?? [];
  const [code, setCode] = useState(STARTER);
  const [preview, setPreview] = useState(STARTER);
  const [title, setTitle] = useState("");
  const [gallery, setGallery] = useState(false);

  if (!open) return null;

  const run = () => setPreview(code);

  const save = () => {
    const t = title.trim() || `Tasarım ${saved.length + 1}`;
    const design: SavedDesign = { id: `${Date.now()}`, title: t, code, createdAt: Date.now() };
    saveConfig({ ...config, savedDesigns: [design, ...saved].slice(0, 100) });
    addToast("Tasarım kaydedildi", "success");
  };
  const del = (id: string) => saveConfig({ ...config, savedDesigns: saved.filter((d) => d.id !== id) });
  const load = (d: SavedDesign) => { setCode(d.code); setPreview(d.code); setTitle(d.title); setGallery(false); };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-modal-bg">
      {/* Üst bar */}
      <div className="brand-rule glass shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3">
        <span className="w-8 h-8 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand">
          <Code2 size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">Tasarım Stüdyosu</div>
          <div className="text-[11px] text-muted/60 leading-tight">Canlı önizleme + galeri · sohbette üret, buraya yapıştır</div>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tasarım adı…"
          className="hidden sm:block ml-3 w-44 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50"
        />
        <button onClick={run} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors" title="Önizlemeyi güncelle">
          <Play size={13} className="text-green" /> Çalıştır
        </button>
        <button onClick={save} className="btn-brand-glow flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold" title="Galeriye kaydet">
          <Save size={13} /> Kaydet
        </button>
        <button onClick={() => setGallery((v) => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${gallery ? "border-brand/50 text-brand" : "border-line hover:border-brand/40"}`} title="Galeri">
          <LayoutGrid size={13} /> {saved.length}
        </button>
        <button onClick={() => setOpen(false)} className="w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors" title="Kapat">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {gallery ? (
          /* Galeri/board */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {saved.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted/50">Henüz kayıtlı tasarım yok. Bir şey çiz, ▶ Çalıştır, sonra Kaydet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button onClick={() => { setCode(STARTER); setPreview(STARTER); setTitle(""); setGallery(false); }} className="premium-card rounded-2xl grid place-items-center min-h-[180px] text-muted/60 hover:text-brand hover:border-brand/40 transition-all hover:-translate-y-0.5">
                  <span className="flex flex-col items-center gap-2"><Plus size={22} /> Yeni tasarım</span>
                </button>
                {saved.map((d) => (
                  <div key={d.id} className="relative premium-card rounded-2xl overflow-hidden group/d">
                    <button onClick={() => load(d)} className="block w-full text-left">
                      <div className="h-40 bg-white overflow-hidden border-b border-line/40">
                        <iframe srcDoc={d.code} title={d.title} sandbox="allow-scripts" className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none" />
                      </div>
                      <div className="px-3 py-2 flex items-center gap-2">
                        <span className="flex-1 text-[12px] font-semibold truncate">{d.title}</span>
                      </div>
                    </button>
                    <button onClick={() => del(d.id)} className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/70 hover:text-red opacity-0 group-hover/d:opacity-100 transition-opacity" title="Sil">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Editör + canlı önizleme */
          <>
            <div className="w-1/2 min-w-0 border-r border-line/60 flex flex-col">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted/45 font-bold border-b border-line/40">Kod (HTML / CSS / JS)</div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
                spellCheck={false}
                className="flex-1 w-full bg-[#0d0c0a] text-ink/90 font-mono text-[12.5px] leading-relaxed p-4 outline-none resize-none"
              />
            </div>
            <div className="w-1/2 min-w-0 flex flex-col bg-white">
              <iframe srcDoc={preview} title="önizleme" sandbox="allow-scripts allow-forms allow-popups" className="flex-1 w-full border-0" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
