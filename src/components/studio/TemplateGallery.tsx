"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { templatesByCategory, type StudioTemplate } from "@/lib/studioTemplates";

/* Şablon galerisi — tek tıkla hazır başlangıç. Kart seçilince StudioView brief +
   skill + tasarım sistemi + yön'ü doldurup üretimi başlatır. */
export function TemplateGallery({
  onApply,
  onClose,
}: {
  onApply: (t: StudioTemplate) => void;
  onClose: () => void;
}) {
  const groups = templatesByCategory();
  const [cat, setCat] = useState<string>("Hepsi");
  const cats = ["Hepsi", ...groups.map((g) => g.category)];
  const shown = cat === "Hepsi" ? groups : groups.filter((g) => g.category === cat);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 grid place-items-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl w-full max-w-4xl h-[82vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
          <h2 className="text-sm font-bold">Hazır Şablonlar</h2>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"><X size={16} /></button>
        </div>

        {/* Kategori filtresi */}
        <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-line overflow-x-auto">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${cat === c ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>{c}</button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-5">
          {shown.map((g) => (
            <div key={g.category}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted/60 mb-2">{g.category}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {g.items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onApply(t)}
                    className="text-left rounded-xl border border-line bg-bgsoft hover:border-brand/50 overflow-hidden transition-colors group"
                  >
                    <div className="h-20 w-full" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}22)` }} />
                    <div className="p-2.5">
                      <div className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">{t.name}</div>
                      <p className="text-[11px] text-muted/80 leading-snug line-clamp-2 mt-0.5">{t.brief}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
