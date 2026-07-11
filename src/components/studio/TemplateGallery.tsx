"use client";

import { Sparkles } from "lucide-react";
import { templatesByCategory, type StudioTemplate } from "@/lib/studioTemplates";

/* Hazır başlangıç ızgarası — sohbet panelinin boş durumu (Claude Design'ın
   "başlamak için bir örnek seç" ekranına paralel). Kart seçimi brief'i
   doğrudan üretime yollar; kullanıcı istersem altındaki kutuya kendi
   brief'ini de yazabilir (bu bileşen yalnız hızlı bir başlangıç, tek yol
   değil). Dar sohbet sütununa (≈380px) sığacak kompakt, kategori-gruplu
   liste — geniş bir galeri/modal DEĞİL. */
export function TemplateGallery({ onPick }: { onPick: (t: StudioTemplate) => void }) {
  const groups = templatesByCategory();

  return (
    <div className="space-y-4">
      <div className="text-center px-2 pt-1">
        <span className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand">
          <Sparkles size={18} />
        </span>
        <p className="text-sm font-semibold text-ink">Ne tasarlayalım?</p>
        <p className="text-xs text-muted/60 mt-1">Bir şablon seç ya da aşağıya kendi brief&apos;ini yaz.</p>
      </div>

      {groups.map((g) => (
        <div key={g.category}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted/45 px-0.5 mb-1.5">{g.category}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {g.items.map((t) => (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="text-left rounded-lg border border-line/60 hover:border-brand/40 p-2 transition-colors"
              >
                <div
                  className="w-full h-8 rounded-md mb-1.5"
                  style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}55)` }}
                  aria-hidden
                />
                <div className="text-[11px] font-semibold text-ink truncate">{t.name}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
