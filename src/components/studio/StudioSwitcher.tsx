"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen, Check, ChevronDown, FileText, Image as ImageIcon, LayoutTemplate,
  ListChecks, Presentation, Sparkles,
} from "lucide-react";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";

/* Tek stüdyo, yedi mod — TÜM stüdyo yüzeylerinin paylaştığı mod anahtarı.
   Her zaman açık 7-ikonluk şerit yerine: aktif modu gösteren TEK bir
   tetikleyici + tıklayınca açılan liste (ExportMenu'nün hafif konumlama
   deseni — portal/ref/resize takibi yok). Mobil ve masaüstü aynı bileşeni
   kullanır; eski xl: kırılma noktası hilesi tamamen kalktı. Yeni yüzey
   eklerken yalnız STUDIO_SURFACES'a ekle (ve uygun grup'a).
   Liste açılınca iki grup halinde gösterilir: Tasarım/Sunum/Tuval (görsel
   çıktı üreten araçlar) bir arada, geri kalan dördü ayrı bir grupta. */

export const STUDIO_SURFACES: { id: Surface; name: string; icon: LucideIcon; title: string; group: "design" | "content" }[] = [
  { id: "studio", name: "Tasarım", icon: Sparkles, title: "Brief ile AI web/UI tasarımı", group: "design" },
  { id: "slides", name: "Sunum", icon: Presentation, title: "Slayt destesi + TTS anlatım", group: "design" },
  { id: "canvas", name: "Tuval", icon: LayoutTemplate, title: "Katman/tuval editörü (slayt · afiş · sosyal)", group: "design" },
  { id: "docs", name: "Doküman", icon: FileText, title: "Blok tabanlı doküman (Markdown/HTML)", group: "content" },
  { id: "forms", name: "Anket", icon: ListChecks, title: "AI anket + bağımsız HTML form", group: "content" },
  { id: "image", name: "Görüntü", icon: ImageIcon, title: "AI görsel üretimi (Pollinations)", group: "content" },
  { id: "notebook", name: "Defter", icon: BookOpen, title: "Kaynak-temelli sohbet + sesli özet", group: "content" },
];

const GROUP_LABELS: Record<"design" | "content", string> = {
  design: "Tasarım",
  content: "İçerik",
};

export function StudioSwitcher({ active }: { active: Surface }) {
  const nav = useSurfaceNav();
  const [open, setOpen] = useState(false);
  const current = STUDIO_SURFACES.find((s) => s.id === active) ?? STUDIO_SURFACES[0];
  const CurrentIcon = current.icon;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 min-w-[104px] px-2.5 py-1.5 rounded-lg border border-brand/30 bg-brand/10 text-brand text-xs font-semibold transition-colors hover:border-brand/50"
      >
        <CurrentIcon size={13} className="shrink-0" />
        <span className="truncate">{current.name}</span>
        <ChevronDown size={13} className={`ml-auto shrink-0 text-brand/70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 z-20 w-72 bg-surface border border-line rounded-xl shadow-2xl p-1 text-sm">
            {(["design", "content"] as const).map((group, gi) => (
              <div key={group}>
                {gi > 0 && <div className="h-px bg-line my-1" />}
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted/45">{GROUP_LABELS[group]}</div>
                {STUDIO_SURFACES.filter((s) => s.group === group).map((s) => {
                  const on = s.id === active;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setOpen(false); if (!on) nav.go(s.id); }}
                      aria-current={on ? "page" : undefined}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                        on ? "bg-brand/10" : "hover:bg-bgsoft"
                      }`}
                    >
                      <Icon size={15} className={`shrink-0 mt-0.5 ${on ? "text-brand" : "text-muted"}`} />
                      <span className="min-w-0">
                        <span className={`block font-semibold text-xs ${on ? "text-brand" : "text-ink"}`}>{s.name}</span>
                        <span className="block text-[11px] text-muted/80 leading-snug mt-0.5">{s.title}</span>
                      </span>
                      {on && <Check size={13} className="text-brand shrink-0 mt-0.5 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
