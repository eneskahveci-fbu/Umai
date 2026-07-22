"use client";

/* Stüdyo rotalarının ortak kabuğu: giriş kapısı + tema sınıfları + toast +
   mobil alt gezinme. İçerideki yüzey bileşeni store bayrağıyla açıldığından,
   rota mount olunca bayrak açılır, ayrılınca kapanır (URL ⇄ durum senkron).
   --surface-pb: mobilde alt bar yüksekliği kadar boşluk — yüzey kökleri
   `pb-[var(--surface-pb,0px)] sm:pb-0` ile kullanır (kaplama modunda 0). */
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useAuthState, useThemeClasses } from "@/lib/authGate";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MobileTabBar, useKeyboardOpen } from "@/components/MobileTabBar";
import { BackgroundJobs } from "@/components/BackgroundJobs";
import { trackEvent } from "@/lib/analytics";

export type SurfaceFlag =
  | "studioOpen" | "docsStudioOpen" | "formsStudioOpen" | "notebookStudioOpen" | "mapStudioOpen" | "cardsStudioOpen";

export function SurfacePage({ flag, children }: {
  flag: SurfaceFlag;
  children: React.ReactNode;
}) {
  /* Misafir erişimi (prompt.md Hamle 2, /app'teki AYNI karar): Stüdyo'nun
     kendisi hesap gerektirmez (yerel/anahtarsız üretim), yalnız bulut
     senkronu gibi hesap-bağlı işler sessizce atlanır. Önceden useAuthGate
     kullanılıyordu — oturumsuz kullanıcıyı /login'e yönlendirip Sidebar/
     mobil alt çubuktan Stüdyo'ya HİÇ girilemiyordu, landing sayfasının
     "herkes için AI stüdyosu" vaadiyle çelişiyordu. */
  const auth = useAuthState();
  useThemeClasses();
  const kbOpen = useKeyboardOpen();

  useEffect(() => {
    const s = useStore.getState();
    const setters: Record<SurfaceFlag, (b: boolean) => void> = {
      studioOpen: s.setStudioOpen,
      docsStudioOpen: s.setDocsStudioOpen,
      formsStudioOpen: s.setFormsStudioOpen,
      notebookStudioOpen: s.setNotebookStudioOpen,
      mapStudioOpen: s.setMapStudioOpen,
      cardsStudioOpen: s.setCardsStudioOpen,
    };
    setters[flag](true);
    trackEvent("surface_open", flag);
    return () => {
      /* Yalnız mount'taki bayrağı değil, HEPSİNİ kapat. /studio/araclar
         (İçerik Araçları) artık sekmeler arası geçişi yeniden mount olmadan
         (surfaceNav.go()'nun aynı-sayfa dalıyla) yapıyor — kullanıcı BAŞKA
         bir sekmedeyken (ör. Kroki) bu sayfadan ayrılırsa, yalnız ilk
         mount'taki bayrağı (ör. formsStudioOpen) kapatmak son aktif olanı
         (mapStudioOpen) kalıcı "açık" bırakırdı. */
      Object.values(setters).forEach((set) => set(false));
    };
  }, [flag]);

  if (auth === "checking") {
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
