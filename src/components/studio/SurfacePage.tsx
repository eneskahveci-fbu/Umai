"use client";

/* Stüdyo rotalarının ortak kabuğu: giriş kapısı + tema sınıfları + toast +
   mobil alt gezinme. İçerideki yüzey bileşeni store bayrağıyla açıldığından,
   rota mount olunca bayrak açılır, ayrılınca kapanır (URL ⇄ durum senkron).
   --surface-pb: mobilde alt bar yüksekliği kadar boşluk — yüzey kökleri
   `pb-[var(--surface-pb,0px)] sm:pb-0` ile kullanır (kaplama modunda 0). */
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useAuthGate, useThemeClasses } from "@/lib/authGate";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MobileTabBar, useKeyboardOpen } from "@/components/MobileTabBar";
import { BackgroundJobs } from "@/components/BackgroundJobs";

export type SurfaceFlag =
  | "studioOpen" | "slidesStudioOpen" | "docsStudioOpen" | "formsStudioOpen"
  | "designStudioOpen" | "imageStudioOpen" | "notebookStudioOpen";

export function SurfacePage({ flag, children }: {
  flag: SurfaceFlag;
  children: React.ReactNode;
}) {
  const auth = useAuthGate();
  useThemeClasses();
  const kbOpen = useKeyboardOpen();

  useEffect(() => {
    const s = useStore.getState();
    const setters: Record<SurfaceFlag, (b: boolean) => void> = {
      studioOpen: s.setStudioOpen,
      slidesStudioOpen: s.setSlidesStudioOpen,
      docsStudioOpen: s.setDocsStudioOpen,
      formsStudioOpen: s.setFormsStudioOpen,
      designStudioOpen: s.setDesignStudioOpen,
      imageStudioOpen: s.setImageStudioOpen,
      notebookStudioOpen: s.setNotebookStudioOpen,
    };
    const set = setters[flag];
    set(true);
    return () => set(false);
  }, [flag]);

  if (auth !== "in") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }
  return (
    <ErrorBoundary>
      <div style={{ "--surface-pb": kbOpen ? "0px" : "calc(52px + env(safe-area-inset-bottom))" } as React.CSSProperties}>
        {children}
        <MobileTabBar />
        <ToastContainer />
        <BackgroundJobs />
      </div>
    </ErrorBoundary>
  );
}
