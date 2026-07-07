"use client";

/* ═══════════════════════════════════════════════════════════════════════
   STUDIO HUB — Birleşik Tasarım Platformu (Open Design)
   ═══════════════════════════════════════════════════════════════════════
   Önceki 7 mod (Tasarım/Sunum/Tuval/Görüntü/Doküman/Anket/Defter)
   artık tek bir "Open Design Studio" altında birleştirildi.

   Yeni yapı:
   - OpenDesignStudio: slayt, afiş, sosyal, story, tuval, deck
   - DocsStudio: doküman oluşturma
   - FormsStudio: anket/form oluşturma
   - ImageStudio: görsel üretimi
   - NotebookStudio: defter

   Tasarım grubu (slayt+tuval+görsel) tek bileşende,
   içerik grubu (doküman+anket+defter) ayrı modlarda.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";
import { OpenDesignStudio } from "./OpenDesignStudio";
import { ImageStudio } from "../ImageStudio";
import { DocsStudio } from "./DocsStudio";
import { FormsStudio } from "./FormsStudio";
import { NotebookStudio } from "./NotebookStudio";

function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

/* Yüzey haritası: "studio" artık OpenDesignStudio'yu çağırır.
   SlidesStudio ve DesignStudio ORTADAN KALDIRILDI — ikisi de
   OpenDesignStudio içinde birleşti. */
const SURFACE_MAP: Record<Surface, React.ComponentType<{ embedded?: boolean }>> = {
  studio: OpenDesignStudio,
  slides: OpenDesignStudio,  // ← birleşti
  canvas: OpenDesignStudio,  // ← birleşti
  image: ImageStudio,
  docs: DocsStudio,
  forms: FormsStudio,
  notebook: NotebookStudio,
};

export function StudioHub() {
  const nav = useSurfaceNav();
  const studioOpen = useStore((s) => s.studioOpen);
  const slidesOpen = useStore((s) => s.slidesStudioOpen);
  const canvasOpen = useStore((s) => s.designStudioOpen);
  const imageOpen = useStore((s) => s.imageStudioOpen);
  const docsOpen = useStore((s) => s.docsStudioOpen);
  const formsOpen = useStore((s) => s.formsStudioOpen);
  const notebookOpen = useStore((s) => s.notebookStudioOpen);

  const everStudio = useEverOpened(studioOpen);
  const everSlides = useEverOpened(slidesOpen);
  const everCanvas = useEverOpened(canvasOpen);
  const everImage = useEverOpened(imageOpen);
  const everDocs = useEverOpened(docsOpen);
  const everForms = useEverOpened(formsOpen);
  const everNotebook = useEverOpened(notebookOpen);

  if (!studioOpen && !slidesOpen && !canvasOpen && !imageOpen && !docsOpen && !formsOpen && !notebookOpen) {
    return null;
  }

  const active: Surface =
    studioOpen ? "studio" : slidesOpen ? "slides" : canvasOpen ? "canvas" :
    imageOpen ? "image" : docsOpen ? "docs" : formsOpen ? "forms" : "notebook";

  // Open Design stüdyoları (studio/slides/canvas) hepsi aynı bileşeni kullanır
  const isOpenDesign = active === "studio" || active === "slides" || active === "canvas";
  const ActiveComponent = SURFACE_MAP[active];

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      {/* Üst çubuk */}
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <StudioSwitcher active={active} />
        <button
          onClick={() => nav.close()}
          className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
          title="Kapat"
        ><X size={16} /></button>
      </div>

      {/* İçerik — hepsi mount edilir, state korunur */}
      {everStudio && active === "studio" && <OpenDesignStudio embedded />}
      {everSlides && active === "slides" && <OpenDesignStudio embedded />}
      {everCanvas && active === "canvas" && <OpenDesignStudio embedded />}
      {everImage && <ImageStudio embedded />}
      {everDocs && <DocsStudio embedded />}
      {everForms && <FormsStudio embedded />}
      {everNotebook && <NotebookStudio embedded />}
    </div>
  );
}
