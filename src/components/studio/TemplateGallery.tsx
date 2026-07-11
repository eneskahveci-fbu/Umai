"use client";

import { templatesByCategory, type StudioTemplate } from "@/lib/studioTemplates";

/* Hazır başlangıç ızgarası — StudioHomeScreen'in "hazır şablonlar" bölümünde
   ikincil bir yol olarak gösterilir (birincil yol: anasayfadaki brief kutusu).
   Kompakt, kategori-gruplu liste; dar (sohbet paneli) ve geniş (anasayfa)
   bağlamlara uyacak şekilde responsive kolon sayısı. */
export function TemplateGallery({ onPick }: { onPick: (t: StudioTemplate) => void }) {
  const groups = templatesByCategory();

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.category}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted/45 px-0.5 mb-1.5">{g.category}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
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
