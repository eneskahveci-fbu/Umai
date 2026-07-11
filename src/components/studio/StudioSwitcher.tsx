"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";

/* Stüdyo mod anahtarı — TEK SAYFA felsefesi (kullanıcı anketi, Tem 2026):
   stüdyoda tek mod kaldı: Tasarım (Claude Design'a paralel tek tuval — slayt,
   afiş, sosyal, story, sunum destesi hepsi orada). Görüntü üretimi Stüdyo'dan
   kaldırıldı, genel sohbette "/gorsel" komutuyla üretiliyor. İçerik araçları
   (Doküman/Anket/Defter) stüdyodan çıktı → Sidebar'daki "Araçlar" satırından
   açılır. Tek yüzey kaldığından bileşen kendini gizler (bkz. aşağı). */

export const STUDIO_SURFACES: { id: Surface; name: string; icon: LucideIcon; title: string }[] = [
  { id: "studio", name: "Tasarım", icon: Sparkles, title: "Slayt · Afiş · Sosyal · Tuval — tek tuval" },
];

/* Eski yüzey adları — geriye uyumluluk (slides/canvas → studio). */
export const LEGACY_SURFACE_MAP: Record<string, Surface> = {
  slides: "studio",
  canvas: "studio",
};

export function StudioSwitcher({ active }: { active: Surface }) {
  const nav = useSurfaceNav();
  const normalized = (LEGACY_SURFACE_MAP[active] ?? active) as Surface;

  /* Tek yüzey kalınca aralarında geçiş yapılacak bir şey kalmıyor — Claude
     Design'ın sade, anahtarsız üst çubuğuna paralel: hiç render etme. */
  if (STUDIO_SURFACES.length <= 1) return null;

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
