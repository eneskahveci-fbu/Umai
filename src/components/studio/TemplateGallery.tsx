"use client";

import type { StudioTemplate } from "@/lib/studioTemplates";

/* Şablon ızgarası — StudioHomeScreen'in kategori-sekmeli vitrini içinde,
   SEÇİLİ TEK kategorinin kartlarını gösterir (Claude Design'ın kendi ana
   ekranındaki gibi — kategori sekmesi değişince ızgara doğrudan güncellenir,
   eskiden olduğu gibi tüm kategoriler alt alta yığılmaz). */
export function TemplateGallery({ templates, onPick }: { templates: StudioTemplate[]; onPick: (t: StudioTemplate) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onPick(t)}
          className="group text-left rounded-xl border border-line/60 bg-surface hover:border-brand/50 hover:bg-bgsoft/40 transition-colors p-2.5"
        >
          <div
            className="w-full h-16 rounded-lg mb-2 transition-transform group-hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}55)` }}
            aria-hidden
          />
          <div className="text-[12px] font-semibold text-ink truncate">{t.name}</div>
        </button>
      ))}
    </div>
  );
}
