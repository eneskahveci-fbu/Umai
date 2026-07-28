"use client";

import { useEffect, useRef, useState } from "react";

/* Modal'ların kapanışına da bir geçiş kazandırır — aksi halde `if (!open)
   return null` deseni içeriği aniden DOM'dan söker, kapanış hep sert olur.
   `open` false olunca `mounted` bir süre daha true kalır (CSS "out"
   animasyonunun bitmesini bekler), sonra gerçekten unmount olur.

     const { mounted, closing } = useExitAnimation(open);
     if (!mounted) return null;
     return (
       <div className={closing ? "animate-modal-bg-out" : "animate-modal-bg"}>
         <div className={closing ? "animate-modal-content-out" : "animate-modal-content"}>...
*/
/* DİKKAT: `exitMs` varsayılanı globals.css'teki `--dur-exit` ile EŞLEŞMELİ —
   CSS "out" animasyonu o kadar sürer, burası da o kadar bekleyip unmount eder.
   İkisi ayrışırsa modal ya animasyon bitmeden kaybolur ya da bittikten sonra
   boş yere ekranda kalır. */
export function useExitAnimation(open: boolean, exitMs = 150) {
  const [mounted, setMounted] = useState(open);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Render-sırasında ayarlama (önceki-değer deseni, DiffModal'daki
     "prevDiffKey" ile aynı fikir): open tekrar true olunca bir effect turunu
     beklemeden hemen göster. Bekleyen kapanış zamanlayıcısı varsa aşağıdaki
     effect'in kendi cleanup'ı zaten iptal eder (ref'e render sırasında
     dokunmaya gerek yok — mounted false olduğunda zamanlayıcı zaten ateşlenmiş
     ve kendini temizlemiştir). */
  if (open && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (open || !mounted) return;
    timerRef.current = setTimeout(() => {
      setMounted(false);
      timerRef.current = null;
    }, exitMs);
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [open, mounted, exitMs]);

  return { mounted, closing: mounted && !open };
}
