"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* /studio/anket → /studio/araclar?tab=anket (Tem 2026: Anket/Defter/Kroki/
   Kartlar tek sayfada birleşti). Eski yer imleri/derin bağlantılar için
   sessizce yönlendirir. */
export default function FormsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio/araclar?tab=anket");
  }, [router]);
  return (
    <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">
      Yönlendiriliyor…
    </div>
  );
}
