"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* /studio/kroki → /studio/araclar?tab=kroki (Tem 2026: Anket/Defter/Kroki/
   Kartlar tek sayfada birleşti). Eski yer imleri/derin bağlantılar için
   sessizce yönlendirir. */
export default function MapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio/araclar?tab=kroki");
  }, [router]);
  return (
    <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">
      Yönlendiriliyor…
    </div>
  );
}
