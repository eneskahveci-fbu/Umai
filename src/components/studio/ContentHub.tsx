"use client";

/* İçerik grubu kabuğu — Doküman/Anket/Defter'i TEK bir kalıcı ekranda
   birleştirir (bkz. DesignHub.tsx — Tasarım grubunun eşleniği, aynı desen).
   3 modun kendi iç mantığı (blok editörü, soru listesi, kaynak-temelli
   sohbet) HİÇ değişmedi — yalnız dış "3 ayrı tam-ekran + 3 ayrı üst çubuk"
   katmanı kalkıyor. Her mod `embedded` prop'uyla kendi sarmalayıcısını/üst
   çubuğunu basmıyor, yalnız içeriğini döndürüyor; bir kez açılan mod
   unmount edilmez (state kaybı yok) — `app/page.tsx`'teki mevcut "ever
   açıldı mı" deseninin aynısı. Tasarım grubu bundan ayrı, kendi kabuğunda
   (DesignHub) kalmaya devam ediyor. */

import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";
import { DocsStudio } from "./DocsStudio";
import { FormsStudio } from "./FormsStudio";
import { NotebookStudio } from "./NotebookStudio";

function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

export function ContentHub() {
  const nav = useSurfaceNav();
  const docsOpen = useStore((s) => s.docsStudioOpen);
  const formsOpen = useStore((s) => s.formsStudioOpen);
  const notebookOpen = useStore((s) => s.notebookStudioOpen);

  const everDocs = useEverOpened(docsOpen);
  const everForms = useEverOpened(formsOpen);
  const everNotebook = useEverOpened(notebookOpen);

  if (!docsOpen && !formsOpen && !notebookOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <StudioSwitcher active={docsOpen ? "docs" : formsOpen ? "forms" : "notebook"} />
        <button
          onClick={() => nav.close()}
          className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
          title="Kapat"
        ><X size={16} /></button>
      </div>
      {everDocs && <DocsStudio embedded />}
      {everForms && <FormsStudio embedded />}
      {everNotebook && <NotebookStudio embedded />}
    </div>
  );
}
