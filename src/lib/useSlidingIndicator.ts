"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sekme şeridi altındaki aktif göstergeyi ZIPLATMADAN kaydırır.
 *
 * Önceden aktif sekme kendi arka planını/çizgisini anında kazanıyordu; göz
 * seçimin nereden nereye gittiğini takip edemiyordu. Gösterge tek bir öğedir
 * ve konumu/genişliği aktif sekmenin ölçüsünden hesaplanır, böylece iki sekme
 * arasında akar (bkz. globals.css `.indicator-track` / `.indicator-thumb`).
 *
 * Kullanım:
 *   const { trackRef, registerTab, style } = useSlidingIndicator(activeKey);
 *   <div ref={trackRef} className="indicator-track flex">
 *     {tabs.map((t) => <button key={t} ref={registerTab(t)} …>)}
 *     <span className="indicator-thumb" style={style} />
 *   </div>
 *
 * Ölçüm layout'tan SONRA yapılır ve pencere yeniden boyutlandığında
 * tazelenir; yazı tipi geç yüklenirse diye ResizeObserver da bağlanır —
 * aksi halde gösterge ilk ölçümde kalıp sekmenin altından kayar.
 */
export function useSlidingIndicator<K extends string>(
  activeKey: K,
  axis: "x" | "y" = "x",
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef(new Map<K, HTMLElement>());
  const [box, setBox] = useState<{ start: number; size: number } | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const el = tabsRef.current.get(activeKey);
    if (!track || !el) return;
    const t = track.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    /* Track'in kendi kaydırma konumu da hesaba katılır: şerit kaydırılabilir
       olduğunda (mobil sekme şeridi, uzun ayar listesi) gösterge aksi hâlde
       yanlış yere düşer. */
    setBox(
      axis === "x"
        ? { start: e.left - t.left + track.scrollLeft, size: e.width }
        : { start: e.top - t.top + track.scrollTop, size: e.height },
    );
  }, [activeKey, axis]);

  useEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    for (const el of tabsRef.current.values()) ro.observe(el);
    window.addEventListener("resize", measure);
    track.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      track.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const registerTab = useCallback(
    (key: K) => (el: HTMLElement | null) => {
      if (el) tabsRef.current.set(key, el);
      else tabsRef.current.delete(key);
    },
    [],
  );

  /* Henüz ölçülmediyse gösterge çizilmez — sıfır konumdan kayarak gelmesi
     "bozuk" görünürdü. */
  const style = box
    ? ({ "--ind-left": `${box.start}px`, "--ind-width": `${box.size}px` } as React.CSSProperties)
    : ({ opacity: 0 } as React.CSSProperties);

  return { trackRef, registerTab, style, measured: !!box };
}
