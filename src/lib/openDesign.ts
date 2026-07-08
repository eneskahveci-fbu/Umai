/* ═══════════════════════════════════════════════════════════════════════
   OPEN DESIGN PLATFORM — Birleşik tasarım veri modeli
   ═══════════════════════════════════════════════════════════════════════
   Tüm çıktı türleri (slayt, afiş, sosyal, form, doküman) tek bir
   "Project" nesnesinde yaşar. Her sayfa/folio kendi formatında
   olabilir ama aynı tasarım sistemi, tema ve marka kurallarını paylaşır.
   ═══════════════════════════════════════════════════════════════════════ */

import type { Align, ImgLayer, Layer } from "./design";
import type { Slide, SlideDeck } from "./types";

/* ── Platform formatları ──────────────────────────────────────────── */

export type CanvasFormat =
  | "slide"      // 16:9 sunum slaytı
  | "slide-wide" // 16:10 geniş sunum
  | "poster"     // Afiş/Poster (dikey)
  | "square"     // Sosyal medya karesi
  | "story"      // Dikey story (9:16)
  | "canvas"     // Serbest tuval (özgür boyut)
  | "doc"        // Doküman (A4 benzeri)
  | "deck";      // Çok-slaytlı destesi (SlidesStudio modu)

export interface FormatDefinition {
  id: CanvasFormat;
  name: string;
  width: number;
  height: number;
  icon: string;
  category: "visual" | "presentation" | "document";
  description: string;
}

export const CANVAS_FORMATS: FormatDefinition[] = [
  { id: "slide", name: "Slayt 16:9", width: 1280, height: 720, icon: "🖥️", category: "presentation", description: "Klasik sunum slaytı" },
  { id: "slide-wide", name: "Slayt 16:10", width: 1440, height: 900, icon: "🖥️", category: "presentation", description: "Geniş ekran sunum" },
  { id: "poster", name: "Afiş", width: 1080, height: 1350, icon: "🖼️", category: "visual", description: "Dikey afiş / poster" },
  { id: "square", name: "Kare (1:1)", width: 1080, height: 1080, icon: "⬜", category: "visual", description: "Sosyal medya karesi" },
  { id: "story", name: "Story (9:16)", width: 1080, height: 1920, icon: "📱", category: "visual", description: "Dikey story" },
  { id: "canvas", name: "Serbest Tuval", width: 1200, height: 800, icon: "🎨", category: "visual", description: "Özgür boyutlu tuval" },
  { id: "doc", name: "Doküman (A4)", width: 1240, height: 1754, icon: "📄", category: "document", description: "Doküman / broşür" },
  { id: "deck", name: "Slayt Destesi", width: 1280, height: 720, icon: "📊", category: "presentation", description: "Çok-slaytlı sunum" },
];

export function formatById(id: CanvasFormat): FormatDefinition {
  return CANVAS_FORMATS.find((f) => f.id === id) ?? CANVAS_FORMATS[0];
}

/* ── Birleşik proje yapısı ────────────────────────────────────────── */

export type ProjectMode = "canvas" | "deck";

export interface ProjectCanvasPage {
  id: string;
  format: CanvasFormat;
  design: {
    bgType: "gradient" | "color" | "image";
    c1: string;
    c2: string;
    bgImage: string;
    layers: Layer[];
    images?: ImgLayer[];
  };
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDeckPage {
  id: string;
  deck: SlideDeck;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type ProjectPage = ProjectCanvasPage | ProjectDeckPage;

export function isCanvasPage(p: ProjectPage): p is ProjectCanvasPage {
  return "design" in p && "format" in (p as ProjectCanvasPage);
}

export function isDeckPage(p: ProjectPage): p is ProjectDeckPage {
  return "deck" in p;
}

export interface OpenDesignProject {
  id: string;
  name: string;
  description?: string;
  mode: ProjectMode;
  pages: ProjectPage[];
  /** Ortak tasarım sistemi referansı. */
  designSystemId?: string;
  /** Ortak marka tokenları. */
  brandTokens?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    logoUrl?: string;
  };
  createdAt: number;
  updatedAt: number;
  /** Etiketler / kategoriler. */
  tags?: string[];
  /** Yerel mi bulut mu. */
  source: "local" | "cloud";
}

/* ── Yardımcılar ──────────────────────────────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 9);

/** Yeni canvas sayfası oluştur. */
export function newCanvasPage(
  format: CanvasFormat,
  name?: string,
): ProjectCanvasPage {
  const fmt = formatById(format);
  return {
    id: `cp_${uid()}_${Date.now().toString(36)}`,
    format,
    name: name ?? fmt.name,
    design: {
      bgType: "gradient",
      c1: "#c8a87e",
      c2: "#1b1a17",
      bgImage: "",
      layers: [],
      images: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Yeni deck sayfası oluştur. */
export function newDeckPage(name?: string): ProjectDeckPage {
  const now = Date.now();
  return {
    id: `dp_${uid()}_${now.toString(36)}`,
    name: name ?? "Slayt Destesi",
    deck: {
      id: `deck_${uid()}_${now.toString(36)}`,
      title: name ?? "Slayt Destesi",
      themeId: "gece",
      slides: [],
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Yeni proje oluştur. */
export function newProject(
  name: string,
  mode: ProjectMode = "canvas",
  format: CanvasFormat = "slide",
): OpenDesignProject {
  const now = Date.now();
  const page = mode === "canvas" ? newCanvasPage(format) : newDeckPage();
  return {
    id: `proj_${uid()}_${now.toString(36)}`,
    name,
    mode,
    pages: [page],
    createdAt: now,
    updatedAt: now,
    source: "local",
  };
}

/** canvas sayfasına slayt formatından sayfa ekle. */
export function canvasPageFromSlide(slide: Slide, theme?: { bg: string; ink: string; accent: string }): ProjectCanvasPage {
  const fmt = formatById("slide");
  return {
    id: `cp_${uid()}_${Date.now().toString(36)}`,
    format: "slide",
    name: slide.title ?? "Slayt",
    design: {
      bgType: "gradient",
      c1: theme?.bg ?? "#111110",
      c2: theme?.bg ?? "#1c1c1a",
      bgImage: "",
      layers: [
        {
          id: uid(),
          text: slide.title ?? "",
          x: 0.5, y: 0.42,
          size: Math.round(fmt.width * 0.075),
          color: theme?.ink ?? "#ffffff",
          weight: 800,
          align: "center" as Align,
          font: "system-ui, sans-serif",
        },
        ...(slide.bullets?.length ? [{
          id: uid(),
          text: slide.bullets.map((b) => `• ${b}`).join("\n"),
          x: 0.5, y: 0.6,
          size: Math.round(fmt.width * 0.03),
          color: theme?.ink ?? "#e2e8f0",
          weight: 400,
          align: "center" as Align,
          font: "system-ui, sans-serif",
        }] : []),
      ],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Canvas sayfasından slide nesnesi üret. */
export function slideFromCanvasPage(page: ProjectCanvasPage): Slide {
  const layers = page.design.layers ?? [];
  const titleLayer = layers.find((l) => l.size > 40) ?? layers[0];
  const bodyLayer = layers.find((l) => l.id !== titleLayer?.id);
  return {
    id: page.id,
    layout: "bullets",
    title: titleLayer?.text ?? "",
    body: bodyLayer?.text ?? undefined,
  };
}

/** Deck'i canvas sayfalarına dönüştür. */
export function deckToCanvasPages(deck: SlideDeck): ProjectCanvasPage[] {
  const theme = { bg: "#111110", ink: "#f4f2ec", accent: "#fbbf24" };
  return deck.slides.map((slide) => canvasPageFromSlide(slide, theme));
}

/** Canvas sayfalarından deck üret. */
export function canvasPagesToDeck(pages: ProjectCanvasPage[], title?: string): SlideDeck {
  const now = Date.now();
  return {
    id: `deck_${uid()}_${now.toString(36)}`,
    title: title ?? "Dönüştürülen Sunum",
    themeId: "gece",
    slides: pages.map((p) => slideFromCanvasPage(p)),
    createdAt: now,
    updatedAt: now,
  };
}

/* ── Fusion desteği ────────────────────────────────────────────────── */

export interface FusionDraft {
  id: string;
  projectId: string;
  pageIndex: number;
  content: string;
  model: string;
  temperature: number;
  createdAt: number;
}

export interface FusionResult {
  drafts: FusionDraft[];
  judgeBest: number;
  judgeGuidance: string;
  finalContent: string;
  modelsUsed: string[];
}

/** Fusion için taslak üretim parametreleri. */
export interface FusionOptions {
  project: OpenDesignProject;
  pageIndex: number;
  brief: string;
  draftCount: 1 | 2 | 3;
  designSystemPrompt?: string;
  craftRules?: string;
}

/* ── Cross-mode dönüştürme ────────────────────────────────────────── */

export type ConversionMode = "canvas-to-deck" | "deck-to-canvas" | "slide-to-canvas" | "canvas-to-slide";

export interface ConversionResult {
  success: boolean;
  sourcePage: ProjectPage;
  targetPage: ProjectPage;
  message: string;
}

/** Tek canvas sayfasını slayt formatına dönüştür. */
export function convertCanvasToSlide(page: ProjectCanvasPage): ProjectCanvasPage {
  return {
    ...page,
    format: "slide",
    name: page.name,
    updatedAt: Date.now(),
  };
}

/** Tek slaytı canvas formatına dönüştür. */
export function convertSlideToCanvas(slide: Slide, theme?: { bg: string; ink: string }): ProjectCanvasPage {
  return canvasPageFromSlide(slide, theme ? { ...theme, accent: "#c8a87e" } : undefined);
}

/** Tüm deck'i canvas sayfalarına dönüştür. */
export function convertDeckToCanvas(deck: SlideDeck): ProjectCanvasPage[] {
  return deckToCanvasPages(deck);
}

/** Tüm canvas sayfalarından deck üret. */
export function convertCanvasToDeck(pages: ProjectCanvasPage[], title?: string): SlideDeck {
  return canvasPagesToDeck(pages, title);
}
