"use client";

/* TEK stüdyo kabuğu — 7 modun tamamı (Tasarım/Sunum/Tuval/Görüntü/Doküman/
   Anket/Defter) tek kalıcı ekranda. Önceki DesignHub + ContentHub ikilisi
   birleştirildi: tek üst çubuk, tek kapat, tek mod anahtarı — gruplar arası
   geçişte bile hiçbir modun state'i kaybolmaz (bir kez açılan mod unmount
   edilmez). Modların iç mantığı değişmedi; yalnız dış kabuk sadeleşti. */

import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";
import { StudioView } from "./StudioView";
import { SlidesStudio } from "./SlidesStudio";
import { ImageStudio } from "../ImageStudio";
import { DesignStudio } from "../DesignStudio";
import { DocsStudio } from "./DocsStudio";
import { FormsStudio } from "./FormsStudio";
import { NotebookStudio } from "./NotebookStudio";

function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

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

  if (!studioOpen && !slidesOpen && !canvasOpen && !imageOpen && !docsOpen && !formsOpen && !notebookOpen) return null;

  const active: Surface =
    studioOpen ? "studio" : slidesOpen ? "slides" : canvasOpen ? "canvas" :
    imageOpen ? "image" : docsOpen ? "docs" : formsOpen ? "forms" : "notebook";

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <StudioSwitcher active={active} />
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
      {everDocs && <DocsStudio embedded />}
      {everForms && <FormsStudio embedded />}
      {everNotebook && <NotebookStudio embedded />}
    </div>
  );
}
