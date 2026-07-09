"use client";

/* Görüntü + içerik araçları (Doküman/Anket/Defter) kabuğu — kullanıcı
   anketi (Tem 2026) sonrası yapı. Tasarım (OpenDesignStudio) artık kendi
   `/studio` rotasında DOĞRUDAN render edilir, bu kabuktan geçmez; bu
   bileşen yalnız `/studio/gorsel`, `/studio/dokuman`, `/studio/anket`,
   `/studio/defter` rotalarının kabuğudur. Üst çubuk: Görüntü'de 2-düğmeli
   Tasarım/Görüntü anahtarı; içerik aracındayken aracın adı görünür. */

import { useState } from "react";
import { BookOpen, FileText, ListChecks, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";
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
  const imageOpen = useStore((s) => s.imageStudioOpen);
  const docsOpen = useStore((s) => s.docsStudioOpen);
  const formsOpen = useStore((s) => s.formsStudioOpen);
  const notebookOpen = useStore((s) => s.notebookStudioOpen);

  const everImage = useEverOpened(imageOpen);
  const everDocs = useEverOpened(docsOpen);
  const everForms = useEverOpened(formsOpen);
  const everNotebook = useEverOpened(notebookOpen);

  if (!imageOpen && !docsOpen && !formsOpen && !notebookOpen) return null;

  const active: Surface = imageOpen ? "image" : docsOpen ? "docs" : formsOpen ? "forms" : "notebook";

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

      {everImage && <ImageStudio />}
      {everDocs && <DocsStudio />}
      {everForms && <FormsStudio />}
      {everNotebook && <NotebookStudio />}
    </div>
  );
}
