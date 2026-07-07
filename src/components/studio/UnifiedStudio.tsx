"use client";

/* ═══════════════════════════════════════════════════════════════════════
   UNIFIED STUDIO — DesignStudio + SlidesStudio birleşimi
   ═══════════════════════════════════════════════════════════════════════
   İki mod tek bileşende:
   - "design" → Hızlı Tasarım (Canva tarzı tuval editörü)
   - "slides"  → Slayt Destesi (Google Slights tarzı çok-slaytlı sunum)

   Paylaşılan altyapı: export, design systems, projeler, fusion desteği.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState } from "react";
import {
  ArrowLeftRight, LayoutTemplate, Presentation,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { DesignStudio } from "../DesignStudio";
import { SlidesStudio } from "./SlidesStudio";

export type UnifiedMode = "design" | "slides";

const MODE_META: Record<UnifiedMode, {
  label: string;
  icon: typeof LayoutTemplate;
  description: string;
}> = {
  design: {
    label: "Hızlı Tasarım",
    icon: LayoutTemplate,
    description: "Tuval üzerinde sürükle-bırak — afiş, sosyal medya, tek sayfa",
  },
  slides: {
    label: "Slayt Destesi",
    icon: Presentation,
    description: "Çok slaytlı sunum — JSON veri temalı render",
  },
};

export function UnifiedStudio({
  embedded,
  initialMode = "design",
}: {
  embedded?: boolean;
  initialMode?: UnifiedMode;
} = {}) {
  const [mode, setMode] = useState<UnifiedMode>(initialMode);
  const addToast = useStore((s) => s.addToast);
  const nav = useSurfaceNav();

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "design" ? "slides" : "design";
      addToast(
        `Mod değiştirildi: ${MODE_META[next].label}`,
        "info",
      );
      return next;
    });
  }, [addToast]);

  const meta = MODE_META[mode];
  const Icon = meta.icon;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Mod içi alt çubuk — mod seçimi + açıklama */}
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line bg-surface/50">
        {/* Mod_segemanter */}
        <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-xs">
          {(Object.keys(MODE_META) as UnifiedMode[]).map((m) => {
            const mMeta = MODE_META[m];
            const MIcon = mMeta.icon;
            const active = m === mode;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all font-semibold ${
                  active
                    ? "bg-brand/15 text-brand shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <MIcon size={13} />
                <span className="hidden sm:inline">{mMeta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mod değiştirme butonu (hızlı toggle) */}
        <button
          onClick={toggleMode}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted hover:text-brand hover:bg-brand/10 transition-colors"
          title="Mod değiştir"
        >
          <ArrowLeftRight size={13} />
          <span className="hidden md:inline">Geç</span>
        </button>

        {/* Mod açıklaması */}
        <span className="hidden lg:block ml-2 text-[11px] text-muted/60 truncate">
          {meta.description}
        </span>

        {/* Sağ taraf — ortak aksiyonlar buraya eklenebilir */}
        <div className="ml-auto" />
      </div>

      {/* Mod içeriği — her ikisi de her zaman mount edilir (state korunur) */}
      <div className="flex-1 min-h-0">
        {mode === "design" && <DesignStudio embedded />}
        {mode === "slides" && <SlidesStudio embedded />}
      </div>
    </div>
  );
}

/* ── Yardımcı: modu dışarıdan kontrol etmek için hook ── */
export function useUnifiedMode() {
  const [mode, setMode] = useState<UnifiedMode>("design");
  const switchTo = useCallback((m: UnifiedMode) => setMode(m), []);
  return { mode, switchTo, toggle: () => setMode((m) => m === "design" ? "slides" : "design") };
}
