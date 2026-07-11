"use client";

/* ═══════════════════════════════════════════════════════════════════════
   SURFACE NAV — Birleşik Tasarım Platformu
   ═══════════════════════════════════════════════════════════════════════
   Önceki 7 yüzey artık 5'e indirildi:

   /studio         → Open Design Studio (slayt+tuval+afiş+sosyal birleşik)
   /studio/gorsel  → AI görsel üretimi
   /studio/dokuman → Doküman
   /studio/anket   → Anket/Form
   /studio/defter  → Defter

   /studio/sunum ve /studio/tuval ARTIK /studio'ya yönlendirilir
   (geriye uyumluluk için redirect).
   ═══════════════════════════════════════════════════════════════════════ */

import { usePathname, useRouter } from "next/navigation";
import { useStore } from "./store";

export type Surface = "studio" | "slides" | "docs" | "forms" | "canvas" | "image" | "notebook";

/* Yeni rota yapısı — slides ve canvas artık /studio'ya yönlendirilir */
export const SURFACE_ROUTES: Record<Surface, string> = {
  studio: "/studio",
  slides: "/studio",       // ← Redirect: birleşik stüdyo
  docs: "/studio/dokuman",
  forms: "/studio/anket",
  canvas: "/studio",       // ← Redirect: birleşik stüdyo
  image: "/studio/gorsel",
  notebook: "/studio/defter",
};

/* Yüzeyler arası brief taşıma (hub'dan araca): sessionStorage, 60 sn tazelik. */
const HANDOFF_KEY = "craft_studio_handoff";

export function setSurfaceHandoff(surface: Surface, brief: string): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ surface, brief, ts: Date.now() }));
  } catch { /* yok say */ }
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

/* Belirli bir kaydı doğrudan açma (⌘K birleşik arama → bir dokümanı/anketi/
   defteri seçince o kayıtla açılsın): aynı sessionStorage deseni, ayrı anahtar. */
const OPEN_ITEM_KEY = "craft_studio_open_item";

export function setSurfaceOpenItem(surface: Surface, itemId: string): void {
  try {
    sessionStorage.setItem(OPEN_ITEM_KEY, JSON.stringify({ surface, itemId, ts: Date.now() }));
  } catch { /* yok say */ }
}

export function consumeSurfaceOpenItem(surface: Surface): string | null {
  try {
    const raw = sessionStorage.getItem(OPEN_ITEM_KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as { surface?: string; itemId?: string; ts?: number };
    if (h.surface !== surface || !h.itemId || Date.now() - (h.ts ?? 0) > 60_000) return null;
    sessionStorage.removeItem(OPEN_ITEM_KEY);
    return h.itemId;
  } catch { return null; }
}

export function useSurfaceNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const routed = pathname.startsWith("/studio");

  const go = (which: Surface) => {
    if (routed) {
      router.push(SURFACE_ROUTES[which]);
      return;
    }
    // Overlay modunda store bayraklarını güncelle
    const s = useStore.getState();
    s.setStudioOpen(which === "studio" || which === "slides" || which === "canvas");
    s.setDocsStudioOpen(which === "docs");
    s.setFormsStudioOpen(which === "forms");
    s.setImageStudioOpen(which === "image");
    s.setNotebookStudioOpen(which === "notebook");
  };

  const close = () => {
    if (routed) {
      router.push("/app");
      return;
    }
    const s = useStore.getState();
    s.setStudioOpen(false);
    s.setDocsStudioOpen(false);
    s.setFormsStudioOpen(false);
    s.setImageStudioOpen(false);
    s.setNotebookStudioOpen(false);
  };

  return { routed, go, close };
}
