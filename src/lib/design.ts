/* Tasarım Stüdyosu veri modeli + saf editör mantığı (undo/redo, nudge).
   Bileşenden bağımsız → birim testlerle doğrulanır. */

export type Align = "left" | "center" | "right";

export interface Layer {
  id: string; text: string;
  /* x,y: 0-1 normalize konum (align'a göre çapa). */
  x: number; y: number;
  size: number; color: string; weight: number; align: Align; font: string;
}

/* Görsel/logo katmanı — x,y: merkez (0-1), w: genişlik/tuval oranı (0-1). */
export interface ImgLayer { id: string; src: string; x: number; y: number; w: number; }

export interface Design {
  fmt: string; w: number; h: number;
  bgType: "gradient" | "color" | "image";
  c1: string; c2: string; bgImage: string;
  layers: Layer[]; images?: ImgLayer[];
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0.5));

export const clonePages = (ps: Design[]): Design[] => JSON.parse(JSON.stringify(ps)) as Design[];

/** Ok tuşu / sürükleme için konum kaydırma — sınırlar 0-1'e kelepçelenir. */
export function nudge<T extends { x: number; y: number }>(l: T, dx: number, dy: number): T {
  return { ...l, x: clamp01(l.x + dx), y: clamp01(l.y + dy) };
}

/* ---- Geçmiş (undo/redo) — `pages` anlık görüntüleri ---- */

export interface HistState { past: Design[][]; future: Design[][] }

export const HIST_MAX = 50;

export const emptyHist = (): HistState => ({ past: [], future: [] });

/** Değişiklik ÖNCESİ durumu kaydeder; redo dalını temizler.
    Son kayıtla birebir aynıysa (ör. odaklanıp hiçbir şey değiştirmemek) atlanır. */
export function pushHist(h: HistState, snapshot: Design[], max = HIST_MAX): HistState {
  const snap = clonePages(snapshot);
  const last = h.past[h.past.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snap)) return { ...h, future: [] };
  return { past: [...h.past, snap].slice(-max), future: [] };
}

/** Geri al: bir önceki durumu döndürür, mevcut durum redo yığınına gider. */
export function undoHist(h: HistState, current: Design[], max = HIST_MAX):
  { hist: HistState; pages: Design[] } | null {
  if (!h.past.length) return null;
  const prev = h.past[h.past.length - 1];
  return {
    hist: { past: h.past.slice(0, -1), future: [clonePages(current), ...h.future].slice(0, max) },
    pages: clonePages(prev),
  };
}

/** Yinele: redo yığınından bir durumu geri getirir. */
export function redoHist(h: HistState, current: Design[], max = HIST_MAX):
  { hist: HistState; pages: Design[] } | null {
  if (!h.future.length) return null;
  const next = h.future[0];
  return {
    hist: { past: [...h.past, clonePages(current)].slice(-max), future: h.future.slice(1) },
    pages: clonePages(next),
  };
}
