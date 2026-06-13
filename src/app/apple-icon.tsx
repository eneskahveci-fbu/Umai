import { ImageResponse } from "next/og";
import { LogoTile } from "./_logo";

/* iOS ana ekran ikonu (Add to Home Screen). 180×180 standart. iOS köşeleri
   kendisi yuvarladığı için tam kare (rounded:false) + güvenli kenar boşluğu. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(LogoTile({ size: 180, rounded: false, pad: 0.17 }), { ...size });
}
