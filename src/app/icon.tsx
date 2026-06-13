import { ImageResponse } from "next/og";
import { LogoTile } from "./_logo";

/* Tarayıcı sekmesi favicon'u. 64px retina-keskin; tarayıcı küçük boyutlara
   indirir. Tasarım ortak LogoTile'dan gelir. */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(LogoTile({ size: 64, rounded: true, pad: 0.1 }), { ...size });
}
