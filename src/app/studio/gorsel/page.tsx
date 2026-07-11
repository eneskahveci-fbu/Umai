"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* /studio/gorsel → /app'e yönlendir. Görüntü üretimi Stüdyo'dan kaldırıldı;
   artık genel sohbette "/gorsel <brief>" komutuyla üretiliyor. Kullanıcı eski
   linkle gelirse sessizce ana sohbete atlar. */
export default function ImageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app");
  }, [router]);
  return (
    <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">
      Yönlendiriliyor…
    </div>
  );
}
