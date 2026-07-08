"use client";

/* TEK stüdyo kabuğu — kullanıcı anketi (Tem 2026) sonrası yapı:
   - Stüdyo = TEK SAYFA tasarım tuvali (OpenDesignStudio: slayt, afiş,
     sosyal, story, tuval, sunum destesi) + Görüntü (AI görsel).
   - İçerik araçları (Doküman/Anket/Defter) stüdyo anahtarından ÇIKTI;
     Sidebar'daki "Araçlar" satırından açılır ama aynı kabukta yaşar
     (rotaları korunur, state kaybolmaz).
   Üst çubuk: tasarım modlarında 2-düğmeli anahtar; içerik aracındayken
   aracın adı görünür. */

import { useState } from "react";
import { BookOpen, FileText, ListChecks, X } from "lucide-react";
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

const CONTENT_LABEL: Partial<Record<Surface, { name: string; icon: typeof FileText }>> = {
  docs: { name: "Doküman", icon: FileText },
  forms: { name: "Anket", icon: ListChecks },
  notebook: { name: "Defter", icon: BookOpen },
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

  const designOpen = studioOpen || slidesOpen || canvasOpen;
  const everDesign = useEverOpened(designOpen);
  const everImage = useEverOpened(imageOpen);
  const everDocs = useEverOpened(docsOpen);
  const everForms = useEverOpened(formsOpen);
  const everNotebook = useEverOpened(notebookOpen);

  if (!designOpen && !imageOpen && !docsOpen && !formsOpen && !notebookOpen) return null;

  const active: Surface =
    designOpen ? "studio" : imageOpen ? "image" :
    docsOpen ? "docs" : formsOpen ? "forms" : "notebook";

  const content = CONTENT_LABEL[active];

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        {content ? (
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <content.icon size={15} className="text-brand" /> {content.name}
          </div>
        ) : (
          <StudioSwitcher active={active} />
        )}
        <button
          onClick={() => nav.close()}
          className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
          title="Kapat"
        ><X size={16} /></button>
      </div>

      {/* Bir kez açılan mod mount kalır — state kaybolmaz. OpenDesign kendi
          bayrağını kontrol etmediğinden görünürlüğü CSS ile yönetilir
          (display:contents → yerleşimi bozmadan gizle/göster). */}
      {everDesign && (
        <div className={designOpen ? "contents" : "hidden"}>
          <OpenDesignStudio embedded />
        </div>
      )}
      {everImage && <ImageStudio embedded />}
      {everDocs && <DocsStudio embedded />}
      {everForms && <FormsStudio embedded />}
      {everNotebook && <NotebookStudio embedded />}
    </div>
  );
}
