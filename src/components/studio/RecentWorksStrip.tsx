"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { relativeTime } from "@/lib/studioProjectState";
import type { StudioProjectBase } from "@/lib/types";

/* X3 — "Son çalışmalar" şeridi.

   Beş içerik yüzeyinin (Doküman/Anket/Defter/Kroki/Kartlar) giriş ekranlarında
   kayıtlı işleri gösteren HİÇBİR liste yoktu (`saved.map` sayısı hepsinde 0):
   kaydettiğin bir dokümana geri dönmenin tek yolu üst çubuktaki klasör
   ikonundan modalı açmaktı. Tasarım stüdyosuna eklenen şeridin (bkz.
   StudioHomeScreen RecentStrip) yüzey-bağımsız hâli — hepsi StudioProjectBase
   türediği için tek bileşen beşine de yetiyor. */
export function RecentWorksStrip<T extends StudioProjectBase>({
  items,
  onOpen,
  label = "Son çalışmalar",
  emptyTitle = "Adsız",
}: {
  items: T[];
  onOpen: (item: T) => void;
  label?: string;
  emptyTitle?: string;
}) {
  /* Referans an mount'ta bir kez alınır — render sırasında Date.now() çağırmak
     saf olmayan bir işlem (React kuralı, eslint react-hooks/purity). */
  const [now] = useState(() => Date.now());
  if (items.length === 0) return null;

  return (
    <div className="w-full">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted/45 mb-2 px-0.5">{label}</h2>
      <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-fade-x pb-1">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onOpen(it)}
            title={it.title || emptyTitle}
            className="group shrink-0 w-40 text-left rounded-xl border border-line/70 bg-surface hover:border-brand/50 hover:bg-bgsoft/40 transition-colors px-3 py-2.5"
          >
            <span className="block text-[12.5px] font-semibold text-ink truncate">{it.title || emptyTitle}</span>
            <span className="flex items-center gap-1 text-[10.5px] text-muted/60 mt-1">
              <Clock size={10} className="shrink-0" /> {relativeTime(it.updatedAt, now)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
