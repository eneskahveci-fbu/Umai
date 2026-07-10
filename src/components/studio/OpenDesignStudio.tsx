"use client";

/* ═══════════════════════════════════════════════════════════════════════
   OPEN DESIGN STUDIO — Birleşik Tasarım Platformu
   ═══════════════════════════════════════════════════════════════════════
   Figma/Canva + OpenAI Canvas hibriti:
   • Tek workspace'te çoklu format (slayt, afiş, sosyal, story, tuval)
   • Sol panel: AI sohbet + brief
   • Orta: Canlı tuval / slayt önizleme
   • Sağ panel: Katmanlar + tweaks + format seçici
   • Alt: Sayfa/folio gezgini (çoklu sayfa)
   • Fusion: 3 model + hakem ile üretim
   • Cross-format: herhangi bir sayfayı diğerine dönüştür
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, ExternalLink, FileText, FolderOpen, Layers, Loader2, Plus, RefreshCw, Save, Send, Settings2, Share2, Sparkles, Square, Trash2, User, LayoutTemplate, MessageSquare, GripVertical, Volume2, VolumeX, X
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { generateArtifact, type StudioPhase } from "@/lib/studioGen";
import { generateDeck } from "@/lib/slidesGen";
import { buildArtifactSrcDoc } from "@/lib/artifactDoc";
import { autoStudioSkill } from "@/lib/autoPilot";
import { type DeviceId } from "@/lib/studioConstants";
import type { StudioProject } from "@/lib/types";
import {
  CANVAS_FORMATS, type CanvasFormat, type OpenDesignProject, type ProjectPage, isCanvasPage, isDeckPage, newProject, newCanvasPage, newDeckPage, formatById, pageToHtml
} from "@/lib/openDesign";
import type { Slide } from "@/lib/types";
import {
  slideImageSrc, slideThemeById, SLIDE_THEMES, slideNarration, type SlideTheme
} from "@/lib/slides";
import { rewriteSlide } from "@/lib/slidesGen";
import { ExportMenu } from "./ExportMenu";
import { StudioTopBar } from "./StudioTopBar";
import { SavedItemsModal } from "./SavedItemsModal";
import { downloadHtml, openInTab, printPdf, publishArtifact } from "@/lib/studioExport";
import { pickDraftModels, fillSelfConsistency, generateDrafts, judgeDrafts, buildBoostInstruction, type DraftJudge } from "@/lib/boost";
import { buildFallbackChain } from "@/lib/fallback";
import { resolveModelApiKey } from "@/lib/secureKeys";
import { fetchTextModels, playTts, stopTts } from "@/lib/pollinations";

/* ── Yardımcılar ──────────────────────────────────────────────────── */

const PHASE_LABEL: Record<StudioPhase, string> = {
  planning: "Planlanıyor…",
  generating: "Tasarım üretiliyor…",
  rendering: "Önizleme hazırlanıyor…",
  done: "Hazır",
  error: "Hata",
};

/* Cihaz önizlemesi — tasarımın gerçek en-boy oranını DEĞİŞTİRMEZ, yalnız
   render genişliğini bir telefon viewport'una sığdırır (web = sınırsız). */
const DEVICE_MAX_WIDTH: Record<DeviceId, number | null> = { web: null, iphone: 390, pixel: 412 };

/* ── Sol Panel: AI Sohbet ─────────────────────────────────────────── */

function ChatPanel({
  messages, busy, phase, onFollowup, onStop,
}: {
  messages: { role: "user" | "assistant"; text: string }[];
  busy: boolean;
  phase: StudioPhase | null;
  onFollowup: (text: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");

  const submit = () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    onFollowup(t);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mesajlar */}
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className="flex gap-2.5 text-sm">
            <div className="shrink-0 w-6 h-6 rounded-full grid place-items-center mt-0.5 border border-line bg-bgsoft">
              {m.role === "user"
                ? <User size={12} className="text-muted" />
                : <Sparkles size={12} className="text-brand" />}
            </div>
            <div className="flex-1 min-w-0 whitespace-pre-wrap break-words leading-relaxed text-ink/90">
              {m.text || <span className="text-muted/60">…</span>}
            </div>
          </div>
        ))}
        {busy && phase && (
          <div className="flex items-center gap-2 text-xs text-brand pl-8">
            <Loader2 size={12} className="animate-spin" /> {PHASE_LABEL[phase]}
          </div>
        )}
      </div>

      {/* Giriş */}
      <div className="shrink-0 border-t border-line p-2.5">
        <div className="flex items-end gap-1.5 rounded-xl border border-line bg-surface focus-within:border-brand/50 px-2 py-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={1}
            placeholder="Değişiklik iste — 'başlığı büyüt', 'mavi yap', 'yeni sayfa ekle'…"
            className="flex-1 bg-transparent resize-none outline-none text-sm py-1 max-h-28"
          />
          {busy ? (
            <button onClick={onStop} className="shrink-0 p-1.5 rounded-lg text-muted hover:text-red" title="Durdur" aria-label="Durdur">
              <Square size={15} />
            </button>
          ) : (
            <button onClick={submit} disabled={!input.trim()} className="shrink-0 p-1.5 rounded-lg text-brand disabled:opacity-30 hover:bg-brand/10" title="Gönder" aria-label="Gönder">
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Orta Panel: Tuval / Önizleme ─────────────────────────────────── */

function CanvasPreview({
  project, activePageIndex, device, slideIdx, setSlideIdx,
}: {
  project: OpenDesignProject;
  activePageIndex: number;
  device: DeviceId;
  slideIdx: number;
  setSlideIdx: (updater: (i: number) => number) => void;
}) {
  const page = project.pages[activePageIndex];

  if (!page) return <EmptyCanvas />;

  if (isDeckPage(page)) {
    // Deck modu — slayt önizleme + slaytlar arası gezinme
    const deck = page.deck;
    const slide = deck.slides[slideIdx] ?? deck.slides[0];
    if (!slide) return <EmptyCanvas />;
    const theme = slideThemeById(deck.themeId);
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 gap-3">
        <div className="w-full max-w-4xl">
          <SlideCanvas slide={slide} theme={theme} />
        </div>
        {deck.slides.length > 1 && (
          <div className="flex items-center gap-3 text-xs text-muted shrink-0">
            <button
              onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
              disabled={slideIdx === 0}
              className="w-7 h-7 grid place-items-center rounded-lg border border-line disabled:opacity-30 hover:bg-bgsoft transition-colors"
              aria-label="Önceki slayt"
            ><ChevronLeft size={14} /></button>
            <span>{slideIdx + 1} / {deck.slides.length}</span>
            <button
              onClick={() => setSlideIdx((i) => Math.min(deck.slides.length - 1, i + 1))}
              disabled={slideIdx === deck.slides.length - 1}
              className="w-7 h-7 grid place-items-center rounded-lg border border-line disabled:opacity-30 hover:bg-bgsoft transition-colors"
              aria-label="Sonraki slayt"
            ><ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    );
  }

  // Canvas modu — AI artifact varsa sandbox iframe, yoksa katman tuvali
  const fmt = formatById(page.format);
  const design = page.design;
  const deviceCap = DEVICE_MAX_WIDTH[device];
  const maxWidth = deviceCap ? Math.min(fmt.width, deviceCap) : fmt.width;
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="relative" style={{ width: "100%", maxWidth, aspectRatio: `${fmt.width}/${fmt.height}` }}>
        {page.aiArtifact ? (
          <iframe
            title={page.name}
            srcDoc={buildArtifactSrcDoc(page.aiArtifact.type, page.aiArtifact.content)}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full rounded-xl shadow-2xl shadow-black/20 border-0 bg-white"
          />
        ) : (
          <div
            className="w-full h-full rounded-xl overflow-hidden shadow-2xl shadow-black/20"
            style={{
              background: design.bgType === "gradient"
                ? `linear-gradient(135deg, ${design.c1}, ${design.c2})`
                : design.c1,
            }}
          >
            {design.layers.map((layer) => (
              <div
                key={layer.id}
                className="absolute select-none"
                style={{
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: `${layer.size}px`,
                  color: layer.color,
                  fontWeight: layer.weight,
                  textAlign: layer.align,
                  fontFamily: layer.font,
                  whiteSpace: "pre-wrap",
                  maxWidth: "80%",
                }}
              >
                {layer.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-xs flex flex-col items-center gap-3">
        <span className="w-14 h-14 rounded-2xl grid place-items-center text-brand bg-brand/10 border border-brand/20 animate-breathe">
          <LayoutTemplate size={24} />
        </span>
        <p className="text-sm font-semibold text-ink">Tasarım alanı boş</p>
        <p className="text-xs text-muted/70">
          ✦ Sohbeti aç ve brief yaz — örn. &ldquo;minimal bir SaaS afişi&rdquo;.
        </p>
      </div>
    </div>
  );
}

/* ── Slayt Canvas (SlidesStudio'dan taşınan) ──────────────────────── */

function SlideCanvas({ slide, theme }: { slide: Slide; theme: SlideTheme }) {
  const img = slideImageSrc(slide, 1280, 720);
  const base: React.CSSProperties = {
    containerType: "inline-size",
    background: theme.bg,
    color: theme.ink,
    fontFamily: theme.bodyFont,
  };
  const accentBar = (
    <span style={{ display: "block", width: "6cqw", height: "0.35cqw", background: theme.accent, marginTop: "1cqw", borderRadius: 2 }} />
  );
  const bullets = (list?: string[]) => (
    <ul style={{ listStyle: "none", display: "grid", gap: "1.4cqw", fontSize: "2cqw", margin: 0, padding: 0 }}>
      {(list ?? []).map((b, i) => (
        <li key={i} style={{ position: "relative", paddingLeft: "2.4cqw", lineHeight: 1.35 }}>
          <span style={{ position: "absolute", left: 0, top: "0.65cqw", width: "1cqw", height: "1cqw", borderRadius: "50%", background: theme.accent }} />
          {b}
        </li>
      ))}
    </ul>
  );

  const inner = () => {
    switch (slide.layout) {
      case "cover":
      case "end":
        return (
          <div style={{ position: "relative", height: "100%", display: "grid", alignContent: "center", justifyItems: "start", zIndex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {img && <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22, zIndex: -1 }} />}
            <h1 style={{ fontFamily: theme.headingFont, fontSize: "4.4cqw", lineHeight: 1.1, letterSpacing: "-0.02em", margin: 0 }}>{slide.title}</h1>
            {slide.subtitle && <p style={{ color: theme.muted, fontSize: "1.8cqw", marginTop: "1.4cqw", maxWidth: "60ch" }}>{slide.subtitle}</p>}
          </div>
        );
      case "section":
        return (
          <div style={{ height: "100%", display: "grid", alignContent: "center", justifyItems: "start" }}>
            <p style={{ color: theme.accent, fontSize: "1.2cqw", letterSpacing: "0.3em", textTransform: "uppercase", margin: 0 }}>— {theme.name} —</p>
            <h1 style={{ fontFamily: theme.headingFont, fontSize: "4.4cqw", lineHeight: 1.1, marginTop: "1.2cqw" }}>{slide.title}</h1>
            {slide.subtitle && <p style={{ color: theme.muted, fontSize: "1.8cqw", marginTop: "1.4cqw" }}>{slide.subtitle}</p>}
          </div>
        );
      case "bullets":
      default:
        return (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontFamily: theme.headingFont, fontSize: "3cqw", margin: 0 }}>{slide.title}{accentBar}</h2>
            {slide.subtitle && <p style={{ color: theme.muted, fontSize: "1.7cqw", margin: "1cqw 0 0" }}>{slide.subtitle}</p>}
            <div style={{ marginTop: "2.2cqw" }}>{bullets(slide.bullets)}</div>
          </div>
        );
    }
  };

  return (
    <div className="w-full aspect-video overflow-hidden rounded-lg" style={base}>
      <div style={{ height: "100%", padding: "4cqw 5.5cqw" }}>{inner()}</div>
    </div>
  );
}

/* ── Sağ Panel: Katmanlar + Format + Tweaks ───────────────────────── */

function RightPanel({
  project, activePageIndex, setProject, activeSlideIdx,
}: {
  project: OpenDesignProject;
  activePageIndex: number;
  setProject: (p: OpenDesignProject) => void;
  activeSlideIdx: number;
}) {
  const [tab, setTab] = useState<"layers" | "format" | "tweaks">("layers");
  const page = project.pages[activePageIndex];

  const tabs = [
    { id: "layers" as const, label: "Katmanlar", icon: Layers },
    { id: "format" as const, label: "Format", icon: LayoutTemplate },
    { id: "tweaks" as const, label: "Ayarlar", icon: Settings2 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab butonları */}
      <div className="flex border-b border-line">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold transition-colors ${
                tab === t.id
                  ? "text-brand border-b-2 border-brand"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* İçerik */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {tab === "layers" && (
          <LayersPanel page={page} />
        )}
        {tab === "format" && (
          <FormatPanel project={project} setProject={setProject} activePageIndex={activePageIndex} />
        )}
        {tab === "tweaks" && (
          <TweaksPanel project={project} setProject={setProject} activePageIndex={activePageIndex} activeSlideIdx={activeSlideIdx} />
        )}
      </div>
    </div>
  );
}

function LayersPanel({ page }: { page?: ProjectPage }) {
  if (!page || isDeckPage(page)) {
    return <p className="text-xs text-muted/60 text-center py-4">Katmanlar sadece tuval modunda görünür.</p>;
  }
  const layers = page.design.layers ?? [];
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted/50 mb-2">Katmanlar ({layers.length})</p>
      {layers.length === 0 && (
        <p className="text-xs text-muted/60 text-center py-4">Katman yok — AI ile tasarım üret.</p>
      )}
      {layers.map((l, i) => (
        <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bgsoft transition-colors text-xs">
          <GripVertical size={12} className="text-muted/40" />
          <span className="flex-1 truncate">{l.text || "(boş)"}</span>
          <span className="text-[10px] text-muted/40">#{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function FormatPanel({
  project, setProject, activePageIndex,
}: {
  project: OpenDesignProject;
  setProject: (p: OpenDesignProject) => void;
  activePageIndex: number;
}) {
  const page = project.pages[activePageIndex];
  const [newPageFormat, setNewPageFormat] = useState<CanvasFormat>("slide");

  const addPage = () => {
    const newPage = isDeckPage(page)
      ? newDeckPage(`Sayfa ${project.pages.length + 1}`)
      : newCanvasPage(newPageFormat, `Sayfa ${project.pages.length + 1}`);
    /* updatedAt damgası kaydetme anında vurulur (render saf kalır). */
    setProject({
      ...project,
      pages: [...project.pages, newPage],
    });
  };

  const removePage = (index: number) => {
    if (project.pages.length <= 1) return;
    const newPages = project.pages.filter((_, i) => i !== index);
    setProject({
      ...project,
      pages: newPages,
    });
  };

  /* Aktif sayfanın formatını değiştirir (yalnız canvas sayfaları — deck'in
     kendi formatı yok). Katman konumları (x/y) normalize (0-1) olduğundan
     oranlı kalır; yazı boyutu (`size`) piksel-mutlak olduğundan çok farklı
     genişlikler arasında geçişte oranı bozulabilir — bilinen sınırlama. */
  const changeFormat = (index: number, format: CanvasFormat) => {
    const p = project.pages[index];
    if (!p || !isCanvasPage(p) || p.format === format) return;
    const newPages = [...project.pages];
    newPages[index] = { ...p, format };
    setProject({ ...project, pages: newPages });
  };

  return (
    <div className="space-y-3">
      {/* Format seçici */}
      <div>
        <p className="text-[10px] text-muted/50 mb-2">Format</p>
        <div className="grid grid-cols-2 gap-1.5">
          {CANVAS_FORMATS.filter((f) => f.id !== "deck").map((f) => (
            <button
              key={f.id}
              onClick={() => changeFormat(activePageIndex, f.id)}
              disabled={!isCanvasPage(page)}
              className={`px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isCanvasPage(page) && page.format === f.id
                  ? "bg-brand/15 text-brand border border-brand/30"
                  : "bg-bgsoft border border-line/60 text-muted hover:text-ink"
              }`}
            >
              <span>{f.icon}</span> {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sayfa ekle */}
      <div className="flex items-center gap-2">
        <select
          value={newPageFormat}
          onChange={(e) => setNewPageFormat(e.target.value as CanvasFormat)}
          className="flex-1 bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs"
        >
          {CANVAS_FORMATS.filter((f) => f.id !== "deck").map((f) => (
            <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
          ))}
        </select>
        <button
          onClick={addPage}
          className="shrink-0 p-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
          title="Sayfa ekle"
          aria-label="Sayfa ekle"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Mevcut sayfalar */}
      <div>
        <p className="text-[10px] text-muted/50 mb-2">Sayfalar ({project.pages.length})</p>
        <div className="space-y-1">
          {project.pages.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                i === activePageIndex ? "bg-brand/10 border border-brand/20" : "hover:bg-bgsoft"
              }`}
            >
              <span className="flex-1 truncate">{p.name}</span>
              {isCanvasPage(p) && (
                <span className="text-[10px] text-muted/40">{formatById(p.format).icon}</span>
              )}
              {isDeckPage(p) && (
                <span className="text-[10px] text-muted/40">📊</span>
              )}
              {project.pages.length > 1 && (
                <button
                  onClick={() => removePage(i)}
                  title="Sayfayı sil"
                  aria-label="Sayfayı sil"
                  className="shrink-0 text-muted/40 hover:text-red"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TWEAK_FONTS = [
  { label: "Sistem", value: "system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
  { label: "Modern", value: "Inter, system-ui, sans-serif" },
];

function TweaksPanel({
  project, setProject, activePageIndex, activeSlideIdx,
}: {
  project: OpenDesignProject;
  setProject: (p: OpenDesignProject) => void;
  activePageIndex: number;
  activeSlideIdx: number;
}) {
  const page = project.pages[activePageIndex];
  if (page && isDeckPage(page)) {
    return <DeckTweaksPanel project={project} setProject={setProject} activePageIndex={activePageIndex} activeSlideIdx={activeSlideIdx} />;
  }
  if (!page || !isCanvasPage(page)) {
    return <p className="text-xs text-muted/60 text-center py-4">İnce ayarlar sadece tuval modunda görünür.</p>;
  }

  /* Tüm metin katmanlarını topluca değiştirir — sayfanın kendisi kaydedilir,
     "temel ölçek" gibi ayrı bir izlenen durum tutulmaz (her tıklama mevcut
     boyutlar üzerinden orantılı uygulanır). */
  const scaleLayers = (factor: number) => {
    const newPages = [...project.pages];
    newPages[activePageIndex] = {
      ...page,
      design: {
        ...page.design,
        layers: page.design.layers.map((l) => ({ ...l, size: Math.round(l.size * factor) })),
      },
    };
    setProject({ ...project, pages: newPages, updatedAt: Date.now() });
  };
  const setFont = (font: string) => {
    const newPages = [...project.pages];
    newPages[activePageIndex] = {
      ...page,
      design: { ...page.design, layers: page.design.layers.map((l) => ({ ...l, font })) },
    };
    setProject({ ...project, pages: newPages, updatedAt: Date.now() });
  };
  const setAccent = (color: string) => {
    const newPages = [...project.pages];
    newPages[activePageIndex] = {
      ...page,
      design: { ...page.design, layers: page.design.layers.map((l) => ({ ...l, color })) },
    };
    setProject({ ...project, pages: newPages, updatedAt: Date.now() });
  };
  const currentFont = page.design.layers[0]?.font ?? TWEAK_FONTS[0].value;
  const currentColor = page.design.layers[0]?.color ?? "#ffffff";

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted/50 mb-2">İnce Ayarlar (tüm metin katmanlarına uygulanır)</p>
      <div className="space-y-3 text-xs">
        <div>
          <span className="text-muted block mb-1.5">Yazı ölçeği</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => scaleLayers(0.9)} className="flex-1 px-2 py-1.5 rounded-lg bg-bgsoft border border-line/60 text-ink hover:border-brand/40 transition-colors">− Küçült</button>
            <button onClick={() => scaleLayers(1.1)} className="flex-1 px-2 py-1.5 rounded-lg bg-bgsoft border border-line/60 text-ink hover:border-brand/40 transition-colors">+ Büyüt</button>
          </div>
        </div>
        <div>
          <span className="text-muted block mb-1.5">Yazı tipi</span>
          <select
            value={currentFont}
            onChange={(e) => setFont(e.target.value)}
            className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs"
          >
            {TWEAK_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Vurgu rengi</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(currentColor) ? currentColor : "#ffffff"}
            onChange={(e) => setAccent(e.target.value)}
            className="w-7 h-7 rounded border border-line/60 cursor-pointer bg-transparent"
            aria-label="Vurgu rengi"
          />
        </div>
      </div>
    </div>
  );
}

/* Deste (deck) sayfaları için ayarlar — tema seçici, AKTİF slaytı yeniden
   yazma (rewriteSlide) ve seslendirme (slideNarration + Pollinations TTS).
   activeSlideIdx üst bileşenden gelir — CanvasPreview'ın gezinme okları ve
   buradaki eylemler AYNI slaydı hedefler. */
function DeckTweaksPanel({
  project, setProject, activePageIndex, activeSlideIdx,
}: {
  project: OpenDesignProject;
  setProject: (p: OpenDesignProject) => void;
  activePageIndex: number;
  activeSlideIdx: number;
}) {
  const config = useStore((s) => s.config);
  const page = project.pages[activePageIndex];
  const deckPage = page && isDeckPage(page) ? page : null;
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const setTheme = useCallback((themeId: string) => {
    if (!deckPage) return;
    const newPages = [...project.pages];
    newPages[activePageIndex] = { ...deckPage, deck: { ...deckPage.deck, themeId } };
    setProject({ ...project, pages: newPages, updatedAt: Date.now() });
  }, [project, activePageIndex, deckPage, setProject]);

  if (!deckPage) return null;
  const deck = deckPage.deck;
  const slide = deck.slides[activeSlideIdx];

  const doRewrite = async () => {
    if (!slide || busy) return;
    setBusy(true);
    try {
      const rewritten = await rewriteSlide({ deck, index: activeSlideIdx, instruction });
      const newSlides = [...deck.slides];
      newSlides[activeSlideIdx] = { ...rewritten, id: slide.id };
      const newPages = [...project.pages];
      newPages[activePageIndex] = { ...deckPage, deck: { ...deck, slides: newSlides, updatedAt: Date.now() } };
      setProject({ ...project, pages: newPages, updatedAt: Date.now() });
      setInstruction("");
    } catch { /* sessizce geç — kullanıcı tekrar deneyebilir */ }
    finally { setBusy(false); }
  };

  const toggleNarrate = () => {
    if (speaking) { stopTts(); setSpeaking(false); return; }
    if (!slide) return;
    setSpeaking(true);
    playTts(slideNarration(slide), config.ttsVoice || "nova", () => setSpeaking(false));
  };

  if (!slide) {
    return <p className="text-xs text-muted/60 text-center py-4">Bu destede henüz slayt yok.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted/50 mb-2">Sunum ayarları (slayt {activeSlideIdx + 1}/{deck.slides.length})</p>
      <div>
        <span className="text-xs text-muted block mb-1.5">Tema</span>
        <div className="grid grid-cols-2 gap-1.5">
          {SLIDE_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`px-2 py-1.5 rounded-lg text-[11px] text-left border transition-colors ${
                deck.themeId === t.id
                  ? "bg-brand/15 text-brand border-brand/30"
                  : "bg-bgsoft border-line/60 text-muted hover:text-ink"
              }`}
            >{t.name}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs text-muted block mb-1.5">Bu slaytı yeniden yaz</span>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder="ör. daha kısa yap, örnek ekle…"
          className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs resize-none outline-none focus:border-brand/50"
        />
        <button
          onClick={() => void doRewrite()}
          disabled={busy}
          className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 disabled:opacity-40 text-xs font-semibold transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Yeniden yaz
        </button>
      </div>
      <button
        onClick={toggleNarrate}
        className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
          speaking ? "border-brand/50 text-brand bg-brand/10" : "border-line text-muted hover:text-ink hover:border-brand/40"
        }`}
      >
        {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />} {speaking ? "Durdur" : "Bu slaytı seslendir"}
      </button>
    </div>
  );
}

/* ── Alt Panel: Sayfa Gezgini ─────────────────────────────────────── */

function PageStrip({
  project, activePageIndex, setActivePageIndex,
}: {
  project: OpenDesignProject;
  activePageIndex: number;
  setActivePageIndex: (i: number) => void;
}) {
  return (
    <div className="h-20 shrink-0 border-t border-line bg-surface/80 flex items-center gap-2 px-3 overflow-x-auto no-scrollbar">
      {project.pages.map((page, i) => (
        <button
          key={page.id}
          onClick={() => setActivePageIndex(i)}
          className={`relative shrink-0 w-16 h-14 rounded-lg border-2 transition-all text-[10px] font-medium flex flex-col items-center justify-center gap-0.5 ${
            i === activePageIndex
              ? "border-brand bg-brand/10 text-brand shadow-sm"
              : "border-line/60 bg-bgsoft text-muted hover:border-brand/30"
          }`}
        >
          {isCanvasPage(page) && page.aiArtifact && (
            <Sparkles size={10} className="absolute top-1 right-1 text-brand" aria-hidden />
          )}
          {isCanvasPage(page) ? (
            <>
              <span className="text-sm">{formatById(page.format).icon}</span>
              <span className="truncate max-w-[56px]">{page.name}</span>
            </>
          ) : (
            <>
              <span className="text-sm">📊</span>
              <span className="truncate max-w-[56px]">Deck</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ANA BİLEŞEN: OpenDesignStudio
   ══════════════════════════════════════════════════════════════════════ */

export interface OpenDesignMsg {
  role: "user" | "assistant";
  text: string;
}

export function OpenDesignStudio() {
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  // Proje durumu
  const [project, setProject] = useState<OpenDesignProject>(() =>
    newProject("Yeni Tasarım", "canvas", "slide")
  );
  const [activePageIndex, setActivePageIndexRaw] = useState(0);
  /* Deck sayfası içinde AKTİF olarak görüntülenen slayt — CanvasPreview'ın
     gezinme okları VE RightPanel'in deck kontrolleri (tema/yeniden yaz/TTS)
     AYNI indeksi paylaşır. Sayfa değişince sıfırlanır. */
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const setActivePageIndex = (i: number) => { setActivePageIndexRaw(i); setActiveSlideIdx(0); };
  const [messages, setMessages] = useState<OpenDesignMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<StudioPhase | null>(null);
  /* Varsayılan kapalı: mobilde tam-ekran overlay'e dönüştüğü için "açık başlar"
     davranışı ekran boyutundan bağımsız tutuluyor (bkz. plan — matchMedia'ya gerek yok). */
  const [sidebarOpen, setSidebarOpen] = useState<"chat" | "right" | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cihaz seçimi
  const [device, setDevice] = useState<DeviceId>("web");

  const activePage = project.pages[activePageIndex];

  // Fusion bayrağı
  const [fusionEnabled, setFusionEnabled] = useState(false);

  /* ── AI Üretim ─────────────────────────────────────────────────── */

  const runGenerate = useCallback(async (brief: string, followup: boolean) => {
    if (!brief.trim() || busy) return;

    setBusy(true);
    setPhase("planning");

    if (!followup) {
      setMessages([
        { role: "user", text: brief },
        { role: "assistant", text: "" },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        { role: "user", text: brief },
        { role: "assistant", text: "" },
      ]);
    }

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Deste (deck) sayfası aktifse ayrı, yapılandırılmış bir üretim yoluna gir
      // (canvas'ın serbest-HTML artifact üretiminden farklı — SlidesStudio'nun
      // kullandığı AYNI generateDeck() ile brief'ten SlideDeck üretilir).
      if (activePage && isDeckPage(activePage)) {
        setPhase("generating");
        const deck = await generateDeck({
          brief,
          slideCount: 6,
          onDelta: (txt) => setMessages((m) => {
            const c = [...m];
            c[c.length - 1] = { role: "assistant", text: txt || "Sunum üretiliyor…" };
            return c;
          }),
          signal: ac.signal,
        });
        setPhase("done");
        const newPages = [...project.pages];
        newPages[activePageIndex] = { ...activePage, deck, name: brief.slice(0, 40), updatedAt: Date.now() };
        setProject({ ...project, pages: newPages, updatedAt: Date.now() });
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", text: "Sunumu oluşturdum." };
          return c;
        });
        return;
      }

      // Fusion modunda 3 taslak üretilir + hakem seçer; sonuç sentez talimatı olarak eklenir
      let boostInstruction: string | undefined;
      if (fusionEnabled) {
        setPhase("generating");
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", text: "✦ Fusion: 3 model ile taslak üretiliyor…" };
          return c;
        });
        try {
          const store = useStore.getState();
          const active = store.strongestModel() ?? store.activeModel();
          if (active) {
            const freeModelNames = await fetchTextModels();
            const manualFusionIds = store.config.fusionMode === "manual" ? store.config.fusionModelIds : undefined;
            const draftProfiles = pickDraftModels(store.config.models, active, 3, store.strongestModel(), freeModelNames, manualFusionIds);
            const slots = fillSelfConsistency(draftProfiles, active, 3);
            const withKeys = await Promise.all(slots.map(async (s) => ({
              baseUrl: s.profile.baseUrl, model: s.profile.model, provider: s.profile.provider,
              apiKey: await resolveModelApiKey(s.profile, store.config.providerKeys), temperature: s.temperature,
            })));
            const fusionFallbacks = buildFallbackChain(store.config.models, active.id);
            const drafts = await generateDrafts({ userText: brief, models: withKeys, fallbacks: fusionFallbacks, signal: ac.signal });
            if (drafts.length) {
              let judge: DraftJudge | null = null;
              if (drafts.length >= 2) {
                const activeKey = await resolveModelApiKey(active, store.config.providerKeys);
                judge = await judgeDrafts({
                  userText: brief, drafts,
                  model: { baseUrl: active.baseUrl, model: active.model, provider: active.provider, apiKey: activeKey },
                  signal: ac.signal,
                });
              }
              boostInstruction = buildBoostInstruction(drafts, judge);
              setMessages((m) => {
                const c = [...m];
                c[c.length - 1] = { role: "assistant", text: `✦ Fusion: ${drafts.length} taslak${judge ? " + hakem kararı" : ""} birleştiriliyor…` };
                return c;
              });
            }
          }
        } catch {
          /* Fusion taslak/hakem başarısızsa sessizce normal üretime düş. */
        }
      }

      const result = await generateArtifact({
        brief,
        skillId: autoStudioSkill(brief) ?? "landing",
        directionId: "minimal",
        boostInstruction,
        onDelta: (txt) => setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", text: txt || "Tasarım üretiliyor…" };
          return c;
        }),
        onPhase: setPhase,
        signal: ac.signal,
      });

      // Sonucu aktif sayfaya uygula
      if (activePage && isCanvasPage(activePage)) {
        const newPages = [...project.pages];
        newPages[activePageIndex] = {
          ...activePage,
          aiArtifact: { type: result.artifact.type, content: result.artifact.content },
          name: brief.slice(0, 40),
          updatedAt: Date.now(),
        };
        setProject({ ...project, pages: newPages, updatedAt: Date.now() });
      }

      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = {
          role: "assistant",
          text: result.text || "Tasarımı oluşturdum.",
        };
        return c;
      });

    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setMessages((m) => m.slice(0, -1));
      } else {
        const msg = e instanceof Error ? e.message : "bilinmeyen hata";
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", text: `Hata: ${msg}` };
          return c;
        });
        addToast(`Üretim hatası: ${msg}`, "error");
      }
    } finally {
      setBusy(false);
      setPhase(null);
      abortRef.current = null;
    }
  }, [busy, project, activePageIndex, activePage, fusionEnabled, addToast]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ── Kaydet ────────────────────────────────────────────────────── */

  const saveProject = useCallback(() => {
    const existing = config.studioProjects ?? [];
    const proj: StudioProject = {
      id: project.id,
      name: project.name,
      brief: messages.find((m) => m.role === "user")?.text ?? "",
      html: "",
      designSystemId: "craft",
      skillId: null,
      directionId: null,
      createdAt: project.createdAt,
      updatedAt: Date.now(),
      openDesignData: project,
    };
    saveConfig({
      ...config,
      studioProjects: [proj, ...existing.filter((p) => p.id !== project.id)].slice(0, 40),
    });
    addToast("Proje kaydedildi.", "success");
  }, [project, config, messages, saveConfig, addToast]);

  /* ── Projelerim (kaydet/aç) ────────────────────────────────────── */

  const savedProjects = config.studioProjects ?? [];

  const openSavedProject = useCallback((p: StudioProject) => {
    const data = p.openDesignData as OpenDesignProject | undefined;
    if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
      addToast("Bu proje eski bir sürümden — verisi okunamadı.", "error");
      return;
    }
    setProject(data);
    setActivePageIndex(0);
    setMessages([]);
    setSavedOpen(false);
  }, [addToast]);

  const removeSavedProject = useCallback((p: StudioProject) => {
    saveConfig({ ...config, studioProjects: (config.studioProjects ?? []).filter((x) => x.id !== p.id) });
  }, [config, saveConfig]);

  /* ── Dışa Aktar ────────────────────────────────────────────────── */

  const handleExport = useCallback(async (format: "html" | "pdf" | "tab" | "publish") => {
    if (!activePage) return;
    const html = pageToHtml(activePage, project.name);
    if (format === "html") {
      downloadHtml(html, project.name);
      addToast("HTML indirildi.", "success");
    } else if (format === "pdf") {
      if (!printPdf(html)) addToast("Yazdırma penceresi açılamadı — pop-up engelleyiciyi kontrol et.", "error");
    } else if (format === "tab") {
      if (!openInTab(html)) addToast("Yeni sekme açılamadı — pop-up engelleyiciyi kontrol et.", "error");
    } else {
      const url = await publishArtifact(project.name, html);
      if (url) addToast("Bağlantı panoya kopyalandı.", "success");
      else addToast("Yayınlama başarısız oldu.", "error");
    }
  }, [activePage, project.name, addToast]);

  /* ── Yeni Proje ────────────────────────────────────────────────── */

  const newProjectAction = useCallback(() => {
    setProject(newProject("Yeni Tasarım", "canvas", "slide"));
    setActivePageIndex(0);
    setMessages([]);
    addToast("Yeni proje oluşturuldu.", "info");
  }, [addToast]);

  /* Kaydet/Projelerim/Fusion/Dışa-aktar/panel-toggle — hem gömülü ince satırda
     hem de bağımsız StudioTopBar'ın `actions` yuvasında AYNI düğmeler kullanılır
     (tek kaynak, iki sarmalayıcı — Docs/Anket/Defter ile aynı desen). */
  const actionButtons = (
    <>
      <button
        onClick={() => setSidebarOpen((s) => (s === "chat" ? null : "chat"))}
        title="AI Sohbet"
        aria-label="AI Sohbet"
        className={`w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg transition-colors ${sidebarOpen === "chat" ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
      ><MessageSquare size={15} /></button>
      <button
        onClick={() => setSidebarOpen((s) => (s === "right" ? null : "right"))}
        title="Katmanlar & Format"
        aria-label="Katmanlar & Format"
        className={`w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg transition-colors ${sidebarOpen === "right" ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
      ><Layers size={15} /></button>
      <button onClick={saveProject} title="Kaydet" aria-label="Kaydet" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
      <button onClick={() => setSavedOpen(true)} title="Projelerim" aria-label="Projelerim" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
      <button
        onClick={() => setFusionEnabled((f) => !f)}
        title="Fusion: 3 model + hakem ile üretim"
        aria-label="Fusion: 3 model + hakem ile üretim"
        className={`w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg transition-colors ${fusionEnabled ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
      ><Sparkles size={15} /></button>
      <ExportMenu
        triggerLabel="Dışa aktar"
        disabled={!activePage}
        options={[
          { key: "html", label: "HTML indir", icon: <Download size={14} className="text-brand" />, onSelect: () => void handleExport("html") },
          { key: "pdf", label: "PDF (yazdır)", icon: <FileText size={14} className="text-brand" />, onSelect: () => void handleExport("pdf") },
          { key: "tab", label: "Yeni sekmede aç", icon: <ExternalLink size={14} className="text-brand" />, onSelect: () => void handleExport("tab") },
          { key: "publish", label: "Yayınla (bağlantı)", icon: <Share2 size={14} className="text-brand" />, onSelect: () => void handleExport("publish"), separatorBefore: true },
        ]}
      />
    </>
  );

  const content = (
    <>
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Ana İçerik: 3 sütun (mobilde sol/sağ panel tam-ekran overlay) */}
        <div className="flex-1 min-h-0 flex relative">
          {sidebarOpen === "chat" && (
            <div className="fixed inset-0 z-40 pt-[env(safe-area-inset-top)] sm:static sm:z-auto sm:pt-0 sm:w-80 sm:shrink-0 sm:border-r border-line flex flex-col min-h-0 bg-bg sm:bg-transparent">
              <div className="sm:hidden h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
                <span className="text-xs font-bold flex items-center gap-1.5"><MessageSquare size={13} className="text-brand" /> AI Sohbet</span>
                <button onClick={() => setSidebarOpen(null)} aria-label="Kapat" className="ml-auto w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={16} /></button>
              </div>
              <ChatPanel
                messages={messages}
                busy={busy}
                phase={phase}
                onFollowup={(t) => runGenerate(t, true)}
                onStop={stop}
              />
            </div>
          )}

          {/* Orta: Tuval */}
          <main className="flex-1 min-h-0 flex flex-col bg-bgsoft/30">
            {/* Cihaz seçici (mobilde gizli — tuval doğal cihaz genişliğini kullanır) */}
            <div className="h-9 shrink-0 flex items-center gap-2 px-3 border-b border-line">
              <div className="hidden sm:flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-xs">
                {(["web", "iphone", "pixel"] as DeviceId[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDevice(d)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      device === d ? "bg-brand/15 text-brand font-semibold" : "text-muted hover:text-ink"
                    }`}
                  >
                    {d === "web" ? "🖥️" : d === "iphone" ? "📱" : "📲"} {d}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1 text-[10px] text-muted/50">
                {activePage && isCanvasPage(activePage) && (
                  <span>{formatById(activePage.format).name} — {formatById(activePage.format).width}×{formatById(activePage.format).height}</span>
                )}
              </div>
            </div>

            {/* Tuval alanı */}
            <div className="flex-1 min-h-0">
              <CanvasPreview
                key={project.pages[activePageIndex]?.id}
                project={project}
                activePageIndex={activePageIndex}
                device={device}
                slideIdx={activeSlideIdx}
                setSlideIdx={setActiveSlideIdx}
              />
            </div>
          </main>

          {sidebarOpen === "right" && (
            <div className="fixed inset-0 z-40 pt-[env(safe-area-inset-top)] sm:static sm:z-auto sm:pt-0 sm:w-64 sm:shrink-0 sm:border-l border-line flex flex-col min-h-0 bg-bg sm:bg-transparent">
              <div className="sm:hidden h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
                <span className="text-xs font-bold flex items-center gap-1.5"><Layers size={13} className="text-brand" /> Katmanlar & Format</span>
                <button onClick={() => setSidebarOpen(null)} aria-label="Kapat" className="ml-auto w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={16} /></button>
              </div>
              <RightPanel
                project={project}
                activePageIndex={activePageIndex}
                setProject={setProject}
                activeSlideIdx={activeSlideIdx}
              />
            </div>
          )}
        </div>

        {/* Alt Panel: Sayfa Gezgini */}
        <PageStrip
          project={project}
          activePageIndex={activePageIndex}
          setActivePageIndex={setActivePageIndex}
        />
      </div>

      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Projelerim"
        icon={LayoutTemplate}
        items={savedProjects}
        getKey={(p) => p.id}
        renderRow={(p) => (
          <>
            <div className="text-sm font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-muted/60">{new Date(p.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openSavedProject}
        onDelete={removeSavedProject}
        emptyLabel="Henüz kayıtlı proje yok."
      />
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <StudioTopBar
        icon={LayoutTemplate}
        label="Tasarım"
        activeSurface="studio"
        showWorkActions
        onNew={newProjectAction}
        onClose={() => nav.close()}
        actions={actionButtons}
      />
      {content}
    </div>
  );
}
