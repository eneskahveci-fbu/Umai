"use client";

import { Check, Loader2, X } from "lucide-react";
import type { Artifact } from "@/lib/types";

/* Varyasyon seçici (Open Design'ın five-direction picker'ına paralel) — aynı brief'in
   farklı tasarım yönlerinde paralel üretilen sürümleri; biri seçilince uygulanır. */
export interface Variation { label: string; art: Artifact | null; }

export function VariationPicker({
  variations,
  busy,
  onPick,
  onClose,
}: {
  variations: Variation[];
  busy: boolean;
  onPick: (a: Artifact) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 grid place-items-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
          <h2 className="text-sm font-bold">Varyasyonlar <span className="text-muted/60 font-normal">— bir yön seç</span></h2>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-full">
            {variations.map((v, i) => (
              <div key={i} className="flex flex-col rounded-xl border border-line bg-bgsoft/40 overflow-hidden min-h-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-line text-xs font-semibold">
                  <span>{v.label}</span>
                  {v.art && (
                    <button onClick={() => onPick(v.art!)} className="flex items-center gap-1 text-brand hover:underline"><Check size={12} /> Seç</button>
                  )}
                </div>
                <div className="flex-1 min-h-0 bg-white grid place-items-center">
                  {v.art ? (
                    <iframe srcDoc={v.art.content} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-full border-0" title={v.label} />
                  ) : (
                    <Loader2 size={20} className={busy ? "animate-spin text-brand" : "text-muted/40"} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
