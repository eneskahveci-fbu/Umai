"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* /studio/tuval → /studio'ya yönlendir (birleşik platform).
   Kullanıcı eski linkle gelirse sessizce ana sayfaya atlar. */
export default function CanvasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio");
  }, [router]);
  return (
    <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">
      Yönlendiriliyor…
    </div>
  );
}
