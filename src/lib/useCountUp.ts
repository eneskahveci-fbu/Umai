"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bir sayıyı eski değerinden yenisine kısa sürede sayarak geçirir.
 *
 * Kullanım/maliyet/token göstergeleri önceden bir kareden diğerine ZIPLIYORDU;
 * değerin değiştiğini fark etmek için sayıya bakıyor olmak gerekiyordu. Kısa
 * bir sayma, değişimi çevresel görüşte bile yakalatır.
 *
 * Ayrıntılar:
 * • İLK değer animasyonsuz gösterilir — sayfa her açılışta 0'dan sayarsa
 *   arayüz "yükleniyor" gibi hissettirir, oysa veri zaten hazırdır.
 * • Hareket tercihi (işletim sistemi "hareketi azalt" ya da Ayarlar → Temel
 *   "kapalı") varsa doğrudan yeni değere atlar — bu bir SÜSLEME, işlevsel
 *   geri bildirim değil.
 * • requestAnimationFrame kullanır ve bileşen sökülünce kareyi iptal eder.
 * • Çok küçük farklarda (varsayılan 1 birim) animasyon yapmaz: akış sırasında
 *   token sayacı gibi sürekli 1-2 artan değerlerde sürekli animasyon başlatmak
 *   hem gereksiz hem de titrek durur.
 */
export function useCountUp(value: number, opts: { durationMs?: number; minDelta?: number } = {}): number {
  const { durationMs = 420, minDelta = 1 } = opts;
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const delta = value - from;
    fromRef.current = value;

    const reduced =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.anim === "off");

    if (reduced || Math.abs(delta) < minDelta || durationMs <= 0) {
      setShown(value);
      return;
    }

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      /* easeOutCubic — hızlı başlar, sonda yumuşar; globals.css'teki
         --ease-out ile aynı his. */
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + delta * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, durationMs, minDelta]);

  return shown;
}
