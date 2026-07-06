"use client";

/* Tasarım grubu kabuğu — Tasarım/Sunum/Tuval/Görüntü'yü TEK bir kalıcı
   ekranda birleştirir (Claude Design'a benzer: tek üst çubuk + within-screen
   mod geçişi). 4 modun kendi iç mantığı (sohbet şekli, üretim akışı, undo/
   redo, TTS, katman düzenleme) HİÇ değişmedi — yalnız dış "4 ayrı tam-ekran +
   4 ayrı üst çubuk" katmanı kalkıyor. Her mod `embedded` prop'uyla kendi
   sarmalayıcısını/üst çubuğunu basmıyor, yalnız içeriğini döndürüyor; bir kez
   açılan mod `hidden` ile gizlenir ama unmount edilmez (state kaybı yok) —
   `app/page.tsx`'teki mevcut "ever açıldı mı" deseninin aynısı. İçerik grubu
   (Doküman/Anket/Defter) bundan ayrı, kendi rotalarında kalmaya devam ediyor. */

import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";
import { StudioView } from "./StudioView";
import { SlidesStudio } from "./SlidesStudio";
import { ImageStudio } from "../ImageStudio";
import { DesignStudio } from "../DesignStudio";

function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

export function DesignHub() {
  const nav = useSurfaceNav();
  const studioOpen = useStore((s) => s.studioOpen);
  const slidesOpen = useStore((s) => s.slidesStudioOpen);
  const canvasOpen = useStore((s) => s.designStudioOpen);
  const imageOpen = useStore((s) => s.imageStudioOpen);

  const everStudio = useEverOpened(studioOpen);
  const everSlides = useEverOpened(slidesOpen);
  const everCanvas = useEverOpened(canvasOpen);
  const everImage = useEverOpened(imageOpen);

  if (!studioOpen && !slidesOpen && !canvasOpen && !imageOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <StudioSwitcher active={studioOpen ? "studio" : slidesOpen ? "slides" : canvasOpen ? "canvas" : "image"} />
        <button
          onClick={() => nav.close()}
          className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
          title="Kapat"
        ><X size={16} /></button>
      </div>
      {everStudio && <StudioView embedded />}
      {everSlides && <SlidesStudio embedded />}
      {everCanvas && <DesignStudio embedded />}
      {everImage && <ImageStudio embedded />}
    </div>
  );
}
