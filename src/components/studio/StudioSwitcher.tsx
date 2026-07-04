"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen, FileText, Image as ImageIcon, LayoutTemplate, ListChecks,
  Presentation, Sparkles,
} from "lucide-react";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";

/* Tek stüdyo, yedi mod — TÜM stüdyo yüzeylerinin paylaştığı mod çubuğu.
   Kural: ikonlar her zaman görünür; etiket yalnız aktif modda (geniş ekranda
   hepsinde) → 7 mod bile tek satırda sakin durur. Yeni yüzey eklerken sadece
   SURFACES listesine ekle; üç ayrı elle yazılmış çubuk dönemi kapandı. */

export const STUDIO_SURFACES: { id: Surface; name: string; icon: LucideIcon; title: string }[] = [
  { id: "studio", name: "Tasarım", icon: Sparkles, title: "Brief ile AI web/UI tasarımı" },
  { id: "slides", name: "Sunum", icon: Presentation, title: "Slayt destesi + TTS anlatım" },
  { id: "docs", name: "Doküman", icon: FileText, title: "Blok tabanlı doküman (Markdown/HTML)" },
  { id: "forms", name: "Anket", icon: ListChecks, title: "AI anket + bağımsız HTML form" },
  { id: "canvas", name: "Tuval", icon: LayoutTemplate, title: "Katman/tuval editörü (slayt · afiş · sosyal)" },
  { id: "image", name: "Görüntü", icon: ImageIcon, title: "AI görsel üretimi (Pollinations)" },
  { id: "notebook", name: "Defter", icon: BookOpen, title: "Kaynak-temelli sohbet + sesli özet" },
];

export function StudioSwitcher({ active }: { active: Surface }) {
  const nav = useSurfaceNav();
  return (
    <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-xs font-semibold shrink min-w-0 overflow-x-auto scrollbar-none">
      {STUDIO_SURFACES.map((s) => {
        const on = s.id === active;
        const Icon = s.icon;
        return (
          <button
            key={s.id}
            onClick={() => { if (!on) nav.go(s.id); }}
            title={s.title}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md transition-colors ${
              on ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={13} />
            <span className={on ? "" : "hidden xl:inline"}>{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
