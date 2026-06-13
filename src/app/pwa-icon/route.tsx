import { ImageResponse } from "next/og";
import { LogoTile } from "../_logo";

/* Manifest PWA ikonları (ana ekran / uygulama çekmecesi). Tek route, ?size ve
   ?maskable parametreleriyle 192/512 "any" ve 512 "maskable" üretir. maskable
   için işaret daha çok kenar boşluğuyla (Android güvenli alanı) ve tam kare
   arka planla çizilir — Android maskeyi kendisi uygular. */
export function GET(request: Request) {
  const u = new URL(request.url);
  const size = Math.min(1024, Math.max(64, parseInt(u.searchParams.get("size") || "512", 10)));
  const maskable = u.searchParams.get("maskable") === "1";
  return new ImageResponse(
    LogoTile({ size, rounded: !maskable, pad: maskable ? 0.26 : 0.12 }),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
