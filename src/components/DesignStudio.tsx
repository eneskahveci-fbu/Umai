"use client";

import { useRef, useState } from "react";
import { Download, Image as ImageIcon, LayoutGrid, Plus, Save, Sparkles, Trash2, Type, Wand2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { SavedDesign } from "@/lib/types";

/* Tasarım Stüdyosu — Canva tarzı: slayt / afiş / broşür / sosyal medya tasarla.
   Şablon seç → metinleri/renkleri düzenle → arka plan (gradyan, renk veya ÜCRETSİZ
   AI görsel) → PNG indir. Tasarımlar galeriye kaydedilir (kişiye özel).
   Önizleme DOM'da; indirme tam çözünürlükte <canvas>'a çizilir. */

type Align = "left" | "center" | "right";
interface Layer { id: string; text: string; x: number; y: number; size: number; color: string; weight: number; align: Align; font: string; }
interface Design { fmt: string; w: number; h: number; bgType: "gradient" | "color" | "image"; c1: string; c2: string; bgImage: string; layers: Layer[]; }

const FORMATS: { id: string; label: string; w: number; h: number }[] = [
  { id: "slide", label: "Slayt 16:9", w: 1280, h: 720 },
  { id: "poster", label: "Afiş / Poster", w: 1080, h: 1350 },
  { id: "a4", label: "Broşür (A4)", w: 1240, h: 1754 },
  { id: "square", label: "Sosyal Kare 1:1", w: 1080, h: 1080 },
  { id: "story", label: "Story 9:16", w: 1080, h: 1920 },
];

const FONTS = ["Georgia, serif", "Arial, sans-serif", "Impact, sans-serif", "'Times New Roman', serif", "'Courier New', monospace", "system-ui, sans-serif"];

const uid = () => Math.random().toString(36).slice(2, 9);

function template(fmt: typeof FORMATS[number]): Design {
  return {
    fmt: fmt.id, w: fmt.w, h: fmt.h, bgType: "gradient", c1: "#c8a87e", c2: "#1b1a17", bgImage: "",
    layers: [
      { id: uid(), text: "BAŞLIK", x: 0.5, y: 0.42, size: Math.round(fmt.w * 0.075), color: "#ffffff", weight: 800, align: "center", font: FONTS[2] },
      { id: uid(), text: "Alt başlık buraya", x: 0.5, y: 0.56, size: Math.round(fmt.w * 0.032), color: "#f0ebe0", weight: 400, align: "center", font: FONTS[0] },
    ],
  };
}

const PRESETS: { name: string; c1: string; c2: string; tc: string }[] = [
  { name: "Amber", c1: "#c8a87e", c2: "#1b1a17", tc: "#ffffff" },
  { name: "Gece", c1: "#1e293b", c2: "#0f172a", tc: "#e2e8f0" },
  { name: "Gün batımı", c1: "#f97316", c2: "#7c2d12", tc: "#fff7ed" },
  { name: "Okyanus", c1: "#0ea5e9", c2: "#0c4a6e", tc: "#f0f9ff" },
  { name: "Orman", c1: "#16a34a", c2: "#14532d", tc: "#f0fdf4" },
  { name: "Krem", c1: "#f5efe2", c2: "#d8cdb4", tc: "#3a2f1d" },
];

export function DesignStudio() {
  const open = useStore((s) => s.designStudioOpen);
  const setOpen = useStore((s) => s.setDesignStudioOpen);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const saved: SavedDesign[] = config.savedDesigns ?? [];
  const [d, setD] = useState<Design>(() => template(FORMATS[0]));
  const [sel, setSel] = useState(0);
  const [gallery, setGallery] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [exporting, setExporting] = useState(false);
  const [title, setTitle] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const upLayer = (patch: Partial<Layer>) =>
    setD((p) => ({ ...p, layers: p.layers.map((l, i) => (i === sel ? { ...l, ...patch } : l)) }));
  const addLayer = () =>
    setD((p) => ({ ...p, layers: [...p.layers, { id: uid(), text: "Yeni metin", x: 0.5, y: 0.75, size: Math.round(p.w * 0.03), color: "#ffffff", weight: 600, align: "center", font: FONTS[0] }] }));
  const delLayer = (i: number) => setD((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== i) }));

  const setFormat = (f: typeof FORMATS[number]) =>
    setD((p) => ({ ...p, fmt: f.id, w: f.w, h: f.h }));

  const genBg = () => {
    const p = genPrompt.trim();
    if (!p) return;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${d.w}&height=${d.h}&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    setD((prev) => ({ ...prev, bgType: "image", bgImage: url }));
  };

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });

  const exportPng = async () => {
    setExporting(true);
    try {
      const cv = document.createElement("canvas");
      cv.width = d.w; cv.height = d.h;
      const ctx = cv.getContext("2d")!;
      if (d.bgType === "image" && d.bgImage) {
        const img = await loadImg(d.bgImage);
        ctx.drawImage(img, 0, 0, d.w, d.h);
      } else if (d.bgType === "color") {
        ctx.fillStyle = d.c1; ctx.fillRect(0, 0, d.w, d.h);
      } else {
        const g = ctx.createLinearGradient(0, 0, d.w, d.h);
        g.addColorStop(0, d.c1); g.addColorStop(1, d.c2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, d.w, d.h);
      }
      for (const L of d.layers) {
        ctx.fillStyle = L.color; ctx.textAlign = L.align; ctx.textBaseline = "middle";
        ctx.font = `${L.weight} ${L.size}px ${L.font}`;
        const maxW = d.w * 0.88;
        const words = L.text.split(" ");
        const lines: string[] = []; let cur = "";
        for (const w of words) {
          const t = cur ? cur + " " + w : w;
          if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
        }
        if (cur) lines.push(cur);
        const lh = L.size * 1.18;
        const px = L.align === "center" ? d.w * L.x : L.align === "right" ? d.w * L.x : d.w * L.x;
        let py = d.h * L.y - ((lines.length - 1) * lh) / 2;
        for (const ln of lines) { ctx.fillText(ln, px, py); py += lh; }
      }
      const blob: Blob | null = await new Promise((r) => cv.toBlob(r, "image/png"));
      if (!blob) throw new Error("boş");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tasarim-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      addToast("İndirme başarısız (AI arka plan CORS engelliyor olabilir — gradyan/renk dene)", "error");
    } finally {
      setExporting(false);
    }
  };

  const save = () => {
    const t = title.trim() || `Tasarım ${saved.length + 1}`;
    const design: SavedDesign = { id: `${Date.now()}`, title: t, code: JSON.stringify(d), createdAt: Date.now() };
    saveConfig({ ...config, savedDesigns: [design, ...saved].slice(0, 100) });
    addToast("Tasarım kaydedildi", "success");
  };
  const load = (sd: SavedDesign) => {
    try { setD(JSON.parse(sd.code) as Design); setTitle(sd.title); setSel(0); setGallery(false); } catch { /* eski format */ }
  };
  const del = (id: string) => saveConfig({ ...config, savedDesigns: saved.filter((x) => x.id !== id) });

  const L = d.layers[sel] ?? d.layers[0];
  const bgStyle: React.CSSProperties =
    d.bgType === "image" && d.bgImage ? { backgroundImage: `url(${d.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : d.bgType === "color" ? { background: d.c1 }
        : { background: `linear-gradient(135deg, ${d.c1}, ${d.c2})` };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-modal-bg">
      <div className="brand-rule glass shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3">
        <span className="w-8 h-8 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand"><Sparkles size={16} /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">Tasarım Stüdyosu</div>
          <div className="text-[11px] text-muted/60 leading-tight">Slayt · Afiş · Broşür · Sosyal — ücretsiz</div>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tasarım adı…" className="hidden sm:block ml-3 w-40 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50" />
        <button onClick={exportPng} disabled={exporting} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors disabled:opacity-50" title="PNG indir">
          <Download size={13} /> {exporting ? "…" : "İndir"}
        </button>
        <button onClick={save} className="btn-brand-glow flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold"><Save size={13} /> Kaydet</button>
        <button onClick={() => setGallery((v) => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${gallery ? "border-brand/50 text-brand" : "border-line hover:border-brand/40"}`}><LayoutGrid size={13} /> {saved.length}</button>
        <button onClick={() => setOpen(false)} className="w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors"><X size={16} /></button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {gallery ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {saved.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted/50">Henüz kayıtlı tasarım yok.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {saved.map((sd) => {
                  let dd: Design | null = null; try { dd = JSON.parse(sd.code) as Design; } catch { /* yok */ }
                  return (
                    <div key={sd.id} className="relative premium-card rounded-2xl overflow-hidden group/d">
                      <button onClick={() => load(sd)} className="block w-full text-left">
                        <div className="aspect-[4/3] grid place-items-center text-white text-xs font-bold" style={dd ? (dd.bgType === "image" && dd.bgImage ? { backgroundImage: `url(${dd.bgImage})`, backgroundSize: "cover" } : dd.bgType === "color" ? { background: dd.c1 } : { background: `linear-gradient(135deg, ${dd.c1}, ${dd.c2})` }) : {}}>
                          {dd?.layers[0]?.text}
                        </div>
                        <div className="px-3 py-2 text-[12px] font-semibold truncate">{sd.title}</div>
                      </button>
                      <button onClick={() => del(sd.id)} className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/70 hover:text-red opacity-0 group-hover/d:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Sol kontrol paneli */}
            <div className="w-72 shrink-0 border-r border-line/60 overflow-y-auto p-4 space-y-4 bg-surface/30">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Boyut</div>
                <select value={d.fmt} onChange={(e) => setFormat(FORMATS.find((f) => f.id === e.target.value)!)} className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-sm outline-none focus:border-brand/50 cursor-pointer">
                  {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.w}×{f.h}</option>)}
                </select>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Arka plan teması</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESETS.map((p) => (
                    <button key={p.name} onClick={() => setD((prev) => ({ ...prev, bgType: "gradient", c1: p.c1, c2: p.c2 }))} title={p.name} className="h-8 rounded-lg border border-line/60 hover:border-brand transition-colors" style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="color" value={d.c1} onChange={(e) => setD((p) => ({ ...p, c1: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent" title="Renk 1" />
                  <input type="color" value={d.c2} onChange={(e) => setD((p) => ({ ...p, c2: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent" title="Renk 2" />
                  <button onClick={() => setD((p) => ({ ...p, bgType: p.bgType === "color" ? "gradient" : "color" }))} className="text-[11px] px-2 py-1 rounded border border-line text-muted hover:text-ink">{d.bgType === "color" ? "Düz" : "Gradyan"}</button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><ImageIcon size={11} /> AI arka plan (ücretsiz)</div>
                <textarea value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} rows={2} placeholder="ör: minimal soyut amber dalgalar" className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand/50 resize-none" />
                <button onClick={genBg} className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors"><Wand2 size={13} className="text-brand" /> Arka plan üret</button>
              </div>

              {/* Katmanlar */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Type size={11} /> Metin katmanları</span>
                  <button onClick={addLayer} className="text-brand hover:text-branddim"><Plus size={13} /></button>
                </div>
                <div className="space-y-1 mb-2">
                  {d.layers.map((ly, i) => (
                    <div key={ly.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer text-xs ${i === sel ? "bg-brand/10 text-brand" : "text-muted hover:bg-bgsoft/60"}`} onClick={() => setSel(i)}>
                      <span className="flex-1 truncate">{ly.text || "(boş)"}</span>
                      {d.layers.length > 1 && <button onClick={(e) => { e.stopPropagation(); delLayer(i); setSel(0); }} className="text-muted/50 hover:text-red"><Trash2 size={11} /></button>}
                    </div>
                  ))}
                </div>
                {L && (
                  <div className="space-y-2 border-t border-line/40 pt-2">
                    <textarea value={L.text} onChange={(e) => upLayer({ text: e.target.value })} rows={2} className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 resize-none" />
                    <div className="flex items-center gap-2">
                      <input type="color" value={L.color} onChange={(e) => upLayer({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                      <input type="range" min={16} max={Math.round(d.w * 0.14)} value={L.size} onChange={(e) => upLayer({ size: +e.target.value })} className="flex-1 accent-brand" />
                    </div>
                    <select value={L.font} onChange={(e) => upLayer({ font: e.target.value })} className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer">
                      {FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0].replace(/'/g, "")}</option>)}
                    </select>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as Align[]).map((a) => (
                        <button key={a} onClick={() => upLayer({ align: a })} className={`flex-1 py-1 rounded text-[11px] border ${L.align === a ? "border-brand text-brand" : "border-line text-muted"}`}>{a === "left" ? "Sol" : a === "center" ? "Orta" : "Sağ"}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted/60">
                      <span>Y:</span>
                      <input type="range" min={0} max={1} step={0.01} value={L.y} onChange={(e) => upLayer({ y: +e.target.value })} className="flex-1 accent-brand" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Önizleme */}
            <div className="flex-1 min-h-0 grid place-items-center p-4 sm:p-8 overflow-auto bg-[#0a0a0d]">
              <div ref={previewRef} className="relative shadow-2xl rounded-sm overflow-hidden" style={{ ...bgStyle, width: "min(100%, 640px)", aspectRatio: `${d.w} / ${d.h}` }}>
                {d.layers.map((ly, i) => (
                  <div
                    key={ly.id}
                    onClick={() => setSel(i)}
                    className={`absolute cursor-pointer px-2 ${i === sel ? "outline outline-1 outline-brand/60" : ""}`}
                    style={{
                      left: ly.align === "left" ? `${ly.x * 100}%` : ly.align === "right" ? undefined : "50%",
                      right: ly.align === "right" ? `${(1 - ly.x) * 100}%` : undefined,
                      top: `${ly.y * 100}%`,
                      transform: ly.align === "center" ? "translate(-50%,-50%)" : "translateY(-50%)",
                      color: ly.color,
                      fontSize: `calc(${ly.size} / ${d.w} * min(100%, 640px))`,
                      fontWeight: ly.weight,
                      fontFamily: ly.font,
                      textAlign: ly.align,
                      width: ly.align === "center" ? "88%" : "auto",
                      maxWidth: "88%",
                      lineHeight: 1.18,
                    }}
                  >
                    {ly.text}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
