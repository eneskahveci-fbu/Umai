"use client";

/* Stüdyo yüzeyleri artık GERÇEK rotalarda yaşar: /studio, /studio/sunum,
   /studio/dokuman, /studio/anket, /studio/tuval, /studio/gorsel,
   /studio/defter — derin bağlantı + tarayıcı geri tuşu.
   Bu kanca yüzeyler arası geçişi ve kapatmayı tek yerden yönetir:
   - Rota modunda (URL /studio*): router.push ile sayfa değiştirir.
   - Kaplama (overlay) modunda (/app içinden açılmışsa): store bayraklarıyla
     eski davranış korunur (geriye uyumluluk). */
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "./store";

export type Surface = "studio" | "slides" | "docs" | "forms" | "canvas" | "image" | "notebook";

export const SURFACE_ROUTES: Record<Surface, string> = {
  studio: "/studio",
  slides: "/studio/sunum",
  docs: "/studio/dokuman",
  forms: "/studio/anket",
  canvas: "/studio/tuval",
  image: "/studio/gorsel",
  notebook: "/studio/defter",
};

/* Yüzeyler arası brief taşıma (hub'dan araca): sessionStorage, 60 sn tazelik. */
const HANDOFF_KEY = "craft_studio_handoff";

export function setSurfaceHandoff(surface: Surface, brief: string): void {
  try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ surface, brief, ts: Date.now() })); } catch { /* yok say */ }
}

/** Hedef yüzey mount olurken çağırır: kendine bırakılan brief'i alır ve siler. */
export function consumeSurfaceHandoff(surface: Surface): string | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as { surface?: string; brief?: string; ts?: number };
    if (h.surface !== surface || !h.brief || Date.now() - (h.ts ?? 0) > 60_000) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    return h.brief;
  } catch { return null; }
}

export function useSurfaceNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const routed = pathname.startsWith("/studio");

  const go = (which: Surface) => {
    if (routed) { router.push(SURFACE_ROUTES[which]); return; }
    const s = useStore.getState();
    s.setStudioOpen(which === "studio");
    s.setSlidesStudioOpen(which === "slides");
    s.setDocsStudioOpen(which === "docs");
    s.setFormsStudioOpen(which === "forms");
    s.setDesignStudioOpen(which === "canvas");
    s.setImageStudioOpen(which === "image");
    s.setNotebookStudioOpen(which === "notebook");
  };

  const close = () => {
    if (routed) { router.push("/app"); return; }
    const s = useStore.getState();
    s.setStudioOpen(false);
    s.setSlidesStudioOpen(false);
    s.setDocsStudioOpen(false);
    s.setFormsStudioOpen(false);
    s.setDesignStudioOpen(false);
    s.setImageStudioOpen(false);
    s.setNotebookStudioOpen(false);
  };

  return { routed, go, close };
}
