"use client";

import type { LucideIcon } from "lucide-react";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";

/* Stüdyo mod anahtarı — TEK SAYFA felsefesi (kullanıcı anketi, Tem 2026):
   stüdyoda yalnız iki mod kaldı: Tasarım (Open Design tek tuval — slayt,
   afiş, sosyal, story, sunum destesi hepsi orada) ve Görüntü (AI görsel).
   İçerik araçları (Doküman/Anket/Defter) stüdyodan çıktı → Sidebar'daki
   "Araçlar" satırından açılır. Dropdown kalktı; iki düğmelik sade şerit. */

export const STUDIO_SURFACES: { id: Surface; name: string; icon: LucideIcon; title: string }[] = [
  { id: "studio", name: "Tasarım", icon: Sparkles, title: "Slayt · Afiş · Sosyal · Tuval — tek tuval" },
  { id: "image", name: "Görüntü", icon: ImageIcon, title: "AI görsel üretimi (Pollinations)" },
];

/* Eski yüzey adları — geriye uyumluluk (slides/canvas → studio). */
export const LEGACY_SURFACE_MAP: Record<string, Surface> = {
  slides: "studio",
  canvas: "studio",
};

export function StudioSwitcher({ active }: { active: Surface }) {
  const nav = useSurfaceNav();
  const normalized = (LEGACY_SURFACE_MAP[active] ?? active) as Surface;

  return (
    <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-xs font-semibold shrink-0">
      {STUDIO_SURFACES.map((s) => {
        const on = s.id === normalized;
        const Icon = s.icon;
        return (
          <button
            key={s.id}
            onClick={() => { if (!on) nav.go(s.id); }}
            title={s.title}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              on ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={13} /> {s.name}
          </button>
        );
      })}
    </div>
  );
}
