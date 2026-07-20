"use client";

/* ═══════════════════════════════════════════════════════════════════════
   SURFACE NAV — Birleşik Tasarım Platformu
   ═══════════════════════════════════════════════════════════════════════
   Yüzeyler:

   /studio         → Tasarım Stüdyosu (Claude Design'a paralel tek tuval)
   /studio/dokuman → Doküman
   /studio/anket   → Anket/Form
   /studio/defter  → Defter

   /studio/sunum, /studio/tuval ve /studio/gorsel ARTIK yönlendirilir
   (geriye uyumluluk için redirect). Görsel üretimi Stüdyo'dan kaldırıldı —
   artık genel sohbette "/gorsel <brief>" komutuyla üretiliyor (bkz. agents.ts). */

import { usePathname, useRouter } from "next/navigation";
import { useStore } from "./store";

export type Surface = "studio" | "slides" | "docs" | "forms" | "canvas" | "notebook" | "map" | "cards";

/* Yeni rota yapısı — slides ve canvas artık /studio'ya yönlendirilir.
   forms/notebook/map/cards AYNI fiziksel rotayı (/studio/araclar) paylaşır
   (Tem 2026 kullanıcı kararı: "özellik kaybetmeden birleştir" — Anket/Defter/
   Kroki/Kartlar tek sayfada sekmeli). ?tab= yalnız İLK açılışta hangi aracın
   aktif olacağını belirler; StudioHub içindeki sekmeler arası geçiş go()'nun
   "aynı sayfadaysa yönlendirme yapma" dalıyla URL'e dokunmadan çalışır (bkz.
   aşağıdaki go()). Eski /studio/anket, /studio/defter, /studio/kroki,
   /studio/kartlar rotaları geriye dönük uyumluluk için buraya yönlendirir. */
export const SURFACE_ROUTES: Record<Surface, string> = {
  studio: "/studio",
  slides: "/studio",       // ← Redirect: birleşik stüdyo
  docs: "/studio/dokuman",
  forms: "/studio/araclar?tab=anket",
  canvas: "/studio",       // ← Redirect: birleşik stüdyo
  notebook: "/studio/araclar?tab=defter",
  map: "/studio/araclar?tab=kroki",
  cards: "/studio/araclar?tab=kartlar",
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
    const target = SURFACE_ROUTES[which];
    if (routed && target.split("?")[0] !== pathname) {
      router.push(target);
      return;
    }
    /* Zaten hedef sayfadayız (İçerik Araçları'nın kendi sekmeleri arası geçiş
       — forms/notebook/map/cards hepsi /studio/araclar'ı paylaşıyor) ya da
       overlay modundayız: yeniden mount'a yol açan bir router.push YAPMA,
       doğrudan bayrakları güncelle. */
    const s = useStore.getState();
    s.setStudioOpen(which === "studio" || which === "slides" || which === "canvas");
    s.setDocsStudioOpen(which === "docs");
    s.setFormsStudioOpen(which === "forms");
    s.setNotebookStudioOpen(which === "notebook");
    s.setMapStudioOpen(which === "map");
    s.setCardsStudioOpen(which === "cards");
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
    s.setNotebookStudioOpen(false);
    s.setMapStudioOpen(false);
    s.setCardsStudioOpen(false);
  };

  return { routed, go, close };
}
