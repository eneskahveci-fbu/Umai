import type { ReactElement } from "react";

/* Tek kaynaklı uygulama logosu — favicon, apple-icon ve PWA ikonları (manifest)
   hepsi bunu kullanır. next/og (Satori + resvg) ile güvenli olması için arka
   plan CSS gradient, işaret ise düz renkli SVG şekillerden oluşur (SVG gradient
   kullanılmaz). Yüksek çözünürlükte keskin: tüm boyutlar tek bir 100×100
   viewBox'tan ölçeklenir.

   Tasarım: "Taş & Çam" (Stone & Pine) temasının koyu kart tonları üzerinde,
   sitede HER YERDE (Sidebar, giriş/açılış sayfaları, yayınlanan artifact
   üst çubuğu) kullanılan GERÇEK marka işareti — pin yeşili (#5c9478) elmas
   çerçeve + merkez nokta. Eski amber "craft altıgeni" tasarımı rebrand
   sonrası bayatlamıştı; artık tek marka görseli tutarlı. */
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
        background: "linear-gradient(140deg, #1c2016 0%, #14170f 55%, #0d0f0b 100%)",
        borderRadius: rounded ? Math.round(size * 0.225) : 0,
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 100 100" fill="none">
        {/* elmas çerçeve — sitedeki gerçek marka işaretiyle aynı geometri */}
        <path
          d="M50 17.86 L78.57 37.5 V62.5 L50 82.14 L21.43 62.5 V37.5 Z"
          stroke="#5c9478"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {/* merkez nokta */}
        <circle cx="50" cy="50" r="10" fill="#5c9478" fillOpacity="0.9" />
      </svg>
    </div>
  );
}
