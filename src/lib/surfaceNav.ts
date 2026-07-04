"use client";

/* Stüdyo yüzeyleri (Stüdyo · Tuval · Görüntü) artık GERÇEK rotalarda yaşar:
   /studio, /studio/tuval, /studio/gorsel — derin bağlantı + tarayıcı geri tuşu.
   Bu kanca yüzeyler arası geçişi ve kapatmayı tek yerden yönetir:
   - Rota modunda (URL /studio*): router.push ile sayfa değiştirir.
   - Kaplama (overlay) modunda (/app içinden açılmışsa): store bayraklarıyla
     eski davranış korunur (geriye uyumluluk). */
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "./store";

export type Surface = "studio" | "slides" | "canvas" | "image";

export const SURFACE_ROUTES: Record<Surface, string> = {
  studio: "/studio",
  slides: "/studio/sunum",
  canvas: "/studio/tuval",
  image: "/studio/gorsel",
};

export function useSurfaceNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const routed = pathname.startsWith("/studio");

  const go = (which: Surface) => {
    if (routed) { router.push(SURFACE_ROUTES[which]); return; }
    const s = useStore.getState();
    s.setStudioOpen(which === "studio");
    s.setSlidesStudioOpen(which === "slides");
    s.setDesignStudioOpen(which === "canvas");
    s.setImageStudioOpen(which === "image");
  };

  const close = () => {
    if (routed) { router.push("/app"); return; }
    const s = useStore.getState();
    s.setStudioOpen(false);
    s.setSlidesStudioOpen(false);
    s.setDesignStudioOpen(false);
    s.setImageStudioOpen(false);
  };

  return { routed, go, close };
}
