"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Rota (sayfa) geçiş animasyonu.
 *
 * Sohbet ↔ Stüdyo ↔ Kütüphane arası geçiş önceden SERT KESMEYDİ: yeni sayfa
 * hiçbir ara adım olmadan beliriyordu. Artık yol (pathname) her değiştiğinde
 * içerik kısa bir açılma + 4px yukarı kaymayla girer (bkz. globals.css
 * `.route-enter`).
 *
 * DOM'a HİÇBİR düğüm eklemez; animasyon sınıfını doğrudan <body> üzerine
 * koyar. Sarmalayıcı bir <div> eklemek cazip görünüyordu ama uygulamanın
 * tam-yükseklik düzenini bozardı: aradaki yüksekliksiz bir düğüm, altındaki
 * `h-full` zincirini kırar (panel/editör yükseklikleri çöker).
 *
 * Neden View Transitions API DEĞİL: o API'yi Next.js'in istemci-taraflı
 * yönlendirmesiyle kullanmak için ya deneysel `experimental.viewTransition`
 * bayrağı ya da tüm <Link> tıklamalarını yakalayan bir kesici gerekir;
 * ikisi de yönlendirmeyi kırma riski taşır ve tarayıcı desteği eşit değil.
 * Bu yaklaşım her tarayıcıda aynı çalışır ve yönlendirmeye hiç dokunmaz.
 *
 * İLK yüklemede animasyon UYGULANMAZ: sayfa zaten sıfırdan boyanıyor, üstüne
 * açılma eklemek açılışı yavaş hissettirir ve içeriğin bir kare saydam
 * kalmasına yol açar.
 */
export function RouteTransition() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (pathname === firstPath.current) return;
    firstPath.current = pathname;

    const body = document.body;
    /* Sınıfı önce KALDIR + reflow'u zorla: art arda hızlı gezinmede tarayıcı
       aynı animasyonu yeniden başlatmaz, sınıf zaten duruyorsa hiçbir şey
       olmaz. Bu iki satır animasyonu güvenilir şekilde yeniden tetikler. */
    body.classList.remove("route-enter");
    void body.offsetWidth;
    body.classList.add("route-enter");

    const done = () => body.classList.remove("route-enter");
    body.addEventListener("animationend", done, { once: true });
    /* animationend gelmezse (hareket kapalıysa animasyon hiç çalışmaz) sınıf
       ekranda takılı kalmasın diye güvenlik ağı. */
    const t = setTimeout(done, 1000);
    return () => {
      clearTimeout(t);
      body.removeEventListener("animationend", done);
      body.classList.remove("route-enter");
    };
  }, [pathname]);

  return null;
}
