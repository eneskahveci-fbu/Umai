"use client";

/* İçerik araçları (Doküman/Anket/Defter/Kroki) kabuğu — kullanıcı anketi (Tem 2026)
   sonrası yapı. Tasarım (DesignStudio) artık kendi `/studio` rotasında
   DOĞRUDAN render edilir, bu kabuktan geçmez; bu bileşen yalnız
   `/studio/dokuman`, `/studio/anket`, `/studio/defter`, `/studio/kroki` rotalarının
   kabuğudur. Görüntü üretimi Stüdyo'dan kaldırıldı (genel sohbette
   "/gorsel" komutu). Üst çubuk: üç aracın kendi arasında yerel bir geçiş
   kontrolü görünür. */

import { useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, FileText, Layers, ListChecks, Network, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";

/* Her araç yalnız kendi rotası açılınca gerçekten gerekli — next/dynamic ile
   hepsi ayrı chunk'ta kalır (ör. /studio/anket ziyareti Doküman/Defter'in
   kodunu indirmez). */
const studioLoading = <div className="flex-1 grid place-items-center text-xs text-muted/50">Yükleniyor…</div>;
const DocsStudio = dynamic(() => import("./DocsStudio").then((m) => m.DocsStudio), { ssr: false, loading: () => studioLoading });
const FormsStudio = dynamic(() => import("./FormsStudio").then((m) => m.FormsStudio), { ssr: false, loading: () => studioLoading });
const NotebookStudio = dynamic(() => import("./NotebookStudio").then((m) => m.NotebookStudio), { ssr: false, loading: () => studioLoading });
const MapStudio = dynamic(() => import("./MapStudio").then((m) => m.MapStudio), { ssr: false, loading: () => studioLoading });
const CardsStudio = dynamic(() => import("./CardsStudio").then((m) => m.CardsStudio), { ssr: false, loading: () => studioLoading });

function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

const CONTENT_LABEL: Partial<Record<Surface, { name: string; icon: typeof FileText }>> = {
  docs: { name: "Doküman", icon: FileText },
  forms: { name: "Anket", icon: ListChecks },
  notebook: { name: "Defter", icon: BookOpen },
  map: { name: "Kroki", icon: Network },
  cards: { name: "Kartlar", icon: Layers },
};

/* İçerik araçları arasında Sidebar'a dönmeden hızlı geçiş — yalnızca bu
   araçların kendi arasında yerel bir kısayol. */
const CONTENT_SURFACES: Surface[] = ["docs", "forms", "notebook", "map", "cards"];

export function StudioHub() {
  const nav = useSurfaceNav();
  const docsOpen = useStore((s) => s.docsStudioOpen);
  const formsOpen = useStore((s) => s.formsStudioOpen);
  const notebookOpen = useStore((s) => s.notebookStudioOpen);
  const mapOpen = useStore((s) => s.mapStudioOpen);
  const cardsOpen = useStore((s) => s.cardsStudioOpen);

  const everDocs = useEverOpened(docsOpen);
  const everForms = useEverOpened(formsOpen);
  const everNotebook = useEverOpened(notebookOpen);
  const everMap = useEverOpened(mapOpen);
  const everCards = useEverOpened(cardsOpen);

  if (!docsOpen && !formsOpen && !notebookOpen && !mapOpen && !cardsOpen) return null;

  const active: Surface = docsOpen ? "docs" : formsOpen ? "forms" : notebookOpen ? "notebook" : mapOpen ? "map" : "cards";

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
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
                <c.icon size={13} /> <span className={isActive ? "" : "hidden sm:inline"}>{c.name}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => nav.close()}
          className="ml-auto w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
          title="Kapat"
        ><X size={16} /></button>
      </div>

      {everDocs && <DocsStudio />}
      {everForms && <FormsStudio />}
      {everNotebook && <NotebookStudio />}
      {everMap && <MapStudio />}
      {everCards && <CardsStudio />}
    </div>
  );
}
