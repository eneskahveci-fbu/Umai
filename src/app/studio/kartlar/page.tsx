"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* /studio/kartlar → /studio/araclar?tab=kartlar (Tem 2026: Anket/Defter/Kroki/
   Kartlar tek sayfada birleşti). Eski yer imleri/derin bağlantılar (ör. Kartlar
   hatırlatma push bildirimi) için sessizce yönlendirir. */
export default function CardsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio/araclar?tab=kartlar");
  }, [router]);
  return (
    <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">
      Yönlendiriliyor…
    </div>
  );
}
