import type { ReactElement } from "react";

/* Tek kaynaklı uygulama logosu — favicon, apple-icon ve PWA ikonları (manifest)
   hepsi bunu kullanır. next/og (Satori + resvg) ile güvenli olması için arka
   plan CSS gradient, işaret ise düz renkli SVG şekillerden oluşur (SVG gradient
   kullanılmaz). Yüksek çözünürlükte keskin: tüm boyutlar tek bir 100×100
   viewBox'tan ölçeklenir.

   Tasarım: koyu, premium bir kart üzerinde amber bir "craft" altıgeni ve
   merkezde dört köşeli bir parıltı (AI kıvılcımı). Sade, yüksek kontrastlı. */
export function LogoTile({
  size,
  rounded = true,
  pad = 0.14,
}: {
  size: number;
  /** true: köşeleri yuvarlat (favicon/any). false: tam kare (maskable/apple). */
  rounded?: boolean;
  /** İşaretin kenar boşluğu oranı (maskable için güvenli alan = daha büyük). */
  pad?: number;
}): ReactElement {
  const mark = Math.round(size * (1 - pad * 2));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(140deg, #24201a 0%, #16140f 60%, #100f0d 100%)",
        borderRadius: rounded ? Math.round(size * 0.225) : 0,
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 100 100" fill="none">
        {/* dış altıgen — "craft" mücevheri */}
        <path
          d="M50 5.5 L88.6 27.75 V72.25 L50 94.5 L11.4 72.25 V27.75 Z"
          stroke="#cda57c"
          strokeWidth="6.5"
          strokeLinejoin="round"
        />
        {/* merkez parıltı — dört köşeli AI kıvılcımı */}
        <path
          d="M50 29 C52.2 43 57 47.8 71 50 C57 52.2 52.2 57 50 71 C47.8 57 43 52.2 29 50 C43 47.8 47.8 43 50 29 Z"
          fill="#ecd2a8"
        />
      </svg>
    </div>
  );
}
