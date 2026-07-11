"use client";

/* Görüntü + içerik araçları (Doküman/Anket/Defter) kabuğu — kullanıcı
   anketi (Tem 2026) sonrası yapı. Tasarım (OpenDesignStudio) artık kendi
   `/studio` rotasında DOĞRUDAN render edilir, bu kabuktan geçmez; bu
   bileşen yalnız `/studio/gorsel`, `/studio/dokuman`, `/studio/anket`,
   `/studio/defter` rotalarının kabuğudur. Üst çubuk: Görüntü'de 2-düğmeli
   Tasarım/Görüntü anahtarı; içerik aracındayken üç aracın kendi arasında
   yerel bir geçiş kontrolü görünür. */

import { useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, FileText, ListChecks, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";

/* Her araç yalnız kendi rotası açılınca gerçekten gerekli — next/dynamic ile
   dördü de ayrı chunk'ta kalır (ör. /studio/anket ziyareti Doküman/Defter/
   Görüntü'nün kodunu indirmez). */
const studioLoading = <div className="flex-1 grid place-items-center text-xs text-muted/50">Yükleniyor…</div>;
const ImageStudio = dynamic(() => import("../ImageStudio").then((m) => m.ImageStudio), { ssr: false, loading: () => studioLoading });
const DocsStudio = dynamic(() => import("./DocsStudio").then((m) => m.DocsStudio), { ssr: false, loading: () => studioLoading });
const FormsStudio = dynamic(() => import("./FormsStudio").then((m) => m.FormsStudio), { ssr: false, loading: () => studioLoading });
const NotebookStudio = dynamic(() => import("./NotebookStudio").then((m) => m.NotebookStudio), { ssr: false, loading: () => studioLoading });

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

/* İçerik araçları (Doküman/Anket/Defter) arasında Sidebar'a dönmeden hızlı
   geçiş — StudioSwitcher'ın tam 5-yüzeyli anahtarını GERİ GETİRMEZ (o karar
   bilinçli kalıyor), yalnızca bu üç aracın kendi arasında yerel bir kısayol. */
const CONTENT_SURFACES: Surface[] = ["docs", "forms", "notebook"];

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
          <div className="flex items-center gap-1 bg-bgsoft rounded-lg p-0.5">
            {CONTENT_SURFACES.map((s) => {
              const c = CONTENT_LABEL[s]!;
              const isActive = s === active;
              return (
                <button
                  key={s}
                  onClick={() => nav.go(s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    isActive ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"
                  }`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <c.icon size={13} /> {c.name}
                </button>
              );
            })}
          </div>
        ) : (
          <StudioSwitcher active={active} />
        )}
        <button
          onClick={() => nav.close()}
          className="ml-auto w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
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
