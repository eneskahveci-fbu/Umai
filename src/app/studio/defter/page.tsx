"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* /studio/defter → /studio/araclar?tab=defter (Tem 2026: Anket/Defter/Kroki/
   Kartlar tek sayfada birleşti). Eski yer imleri/derin bağlantılar için
   sessizce yönlendirir. */
export default function NotebookRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio/araclar?tab=defter");
  }, [router]);
  return (
    <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">
      Yönlendiriliyor…
    </div>
  );
}
