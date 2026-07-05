"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Download, Loader2, MonitorPlay, Plus, Presentation,
  Printer, RefreshCw, Save, Sparkles, Trash2, Volume2, VolumeX, Wand2, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { consumeSurfaceHandoff, useSurfaceNav } from "@/lib/surfaceNav";
import { StudioTopBar } from "./StudioTopBar";
import { SavedItemsModal } from "./SavedItemsModal";
import { downloadTemplate, pickTemplateFile } from "@/lib/templateShare";
import { downloadHtml, printPdf as printPdfDoc } from "@/lib/studioExport";
import type { Slide, SlideDeck, SlideLayout } from "@/lib/types";
import {
  deckToHtml, MAX_SLIDES, newSlide, SLIDE_LAYOUTS, SLIDE_THEMES,
  slideImageSrc, slideNarration, slideThemeById, type SlideTheme,
} from "@/lib/slides";
import { generateDeck, rewriteSlide } from "@/lib/slidesGen";
import { playTts, pollinationsImageUrl, stopTts, TTS_VOICES } from "@/lib/pollinations";

/* Sunum Stüdyosu — Google Slides'tan İLHAM alan craft yorumu (klon değil):
   brief → yapılandırılmış slayt destesi (JSON) → deterministik tema render'ı.
   Slaytlar veri olarak kaldığından her şey kayıpsız: tema değişimi, tek slaytı
   AI ile yeniden yazma, Pollinations görseli, TTS anlatım, bağımsız HTML/PDF
   dışa aktarma. Ücretsiz ve anahtarsız çalışır (Pollinations tabanı). */

const COUNTS = [5, 8, 12];

const SUGGESTIONS = [
  "Yatırımcı sunumu: yapay zekâ destekli Türkçe kodlama asistanı craft",
  "Ders anlatımı: fotosentez — lise seviyesinde, örneklerle",
  "Ürün lansmanı: akıllı ev enerji takip uygulaması",
  "Ekip toplantısı: 3. çeyrek hedefleri ve yol haritası",
];

/* ── Tek slayt render'ı (filmstrip + ana sahne aynı bileşeni kullanır) ──
   Boyutlar container-query birimleriyle (cqw) → her ölçekte aynı kompozisyon. */
function SlideCanvas({ slide, theme }: { slide: Slide; theme: SlideTheme }) {
  const img = slideImageSrc(slide, 1280, 720);
  const base: React.CSSProperties = {
    containerType: "inline-size",
    background: theme.bg, color: theme.ink, fontFamily: theme.bodyFont,
  };
  const accentBar = <span style={{ display: "block", width: "6cqw", height: "0.35cqw", background: theme.accent, marginTop: "1cqw", borderRadius: 2 }} />;
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
            {/* eslint-disable-next-line @next/next/no-img-element -- dış Pollinations URL'i */}
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
      case "quote":
        return (
          <div style={{ height: "100%", display: "grid", alignContent: "center", justifyItems: "start" }}>
            <blockquote style={{ fontFamily: theme.headingFont, fontSize: "3.2cqw", lineHeight: 1.3, maxWidth: "32ch", margin: 0 }}>
              “{slide.body || slide.title}”
            </blockquote>
            {slide.subtitle && <p style={{ color: theme.muted, fontSize: "1.6cqw", marginTop: "1.6cqw" }}>{slide.subtitle}</p>}
          </div>
        );
      case "image":
        return (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, minHeight: 0, borderRadius: "1cqw", overflow: "hidden", background: theme.surface }}>
              {img
                // eslint-disable-next-line @next/next/no-img-element -- dış Pollinations URL'i
                ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${theme.surface}, ${theme.bg})` }} />}
            </div>
            <div style={{ paddingTop: "1.4cqw" }}>
              <h2 style={{ fontFamily: theme.headingFont, fontSize: "2.2cqw", margin: 0 }}>{slide.title}</h2>
              {slide.body && <p style={{ color: theme.muted, fontSize: "1.5cqw", marginTop: "0.6cqw" }}>{slide.body}</p>}
            </div>
          </div>
        );
      case "two-col":
        return (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontFamily: theme.headingFont, fontSize: "3cqw", margin: 0, marginBottom: "1cqw" }}>{slide.title}{accentBar}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3.4cqw", alignItems: "start", marginTop: "1.6cqw" }}>
              {bullets(slide.bullets)}
              <div>
                {slide.body
                  ? <p style={{ fontSize: "1.9cqw", lineHeight: 1.5, margin: 0 }}>{slide.body}</p>
                  // eslint-disable-next-line @next/next/no-img-element -- dış Pollinations URL'i
                  : (img && <img src={img} alt="" style={{ width: "100%", borderRadius: "1cqw" }} />)}
              </div>
            </div>
          </div>
        );
      case "bullets":
      default:
        return (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontFamily: theme.headingFont, fontSize: "3cqw", margin: 0 }}>{slide.title}{accentBar}</h2>
            {slide.subtitle && <p style={{ color: theme.muted, fontSize: "1.7cqw", margin: "1cqw 0 0" }}>{slide.subtitle}</p>}
            <div style={{ marginTop: "2.2cqw" }}>{bullets(slide.bullets)}</div>
            {slide.body && <p style={{ fontSize: "1.8cqw", lineHeight: 1.5, color: theme.muted, marginTop: "1.8cqw", maxWidth: "70ch" }}>{slide.body}</p>}
          </div>
        );
    }
  };
  return (
    <div className="w-full aspect-video overflow-hidden" style={base}>
      <div style={{ height: "100%", padding: "4cqw 5.5cqw" }}>{inner()}</div>
    </div>
  );
}

export function SlidesStudio() {
  const open = useStore((s) => s.slidesStudioOpen);
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const [view, setView] = useState<"home" | "work">("home");
  const [brief, setBrief] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [themeId, setThemeId] = useState("gece");
  const [deck, setDeck] = useState<SlideDeck | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rewriteText, setRewriteText] = useState("");
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [decksOpen, setDecksOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const voice = config.ttsVoice || "nova";
  const theme = slideThemeById(deck?.themeId ?? themeId);

  /* Ok tuşlarıyla slayt gezinme (input/textarea odaktayken karışma). */
  useEffect(() => {
    if (view !== "work" || playerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setSel((i) => Math.min((deck?.slides.length ?? 1) - 1, i + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setSel((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, playerOpen, deck?.slides.length]);

  /* Yüzeyden çıkınca sesi kes. */
  useEffect(() => () => stopTts(), []);

  /* Hub'dan taşınan brief'i al (tek stüdyo hissi). */
  useEffect(() => {
    const b = consumeSurfaceHandoff("slides");
    if (!b) return;
    const id = setTimeout(() => setBrief(b), 0);
    return () => clearTimeout(id);
  }, []);

  if (!open) return null;

  const slide: Slide | null = deck ? deck.slides[Math.min(sel, deck.slides.length - 1)] ?? null : null;

  /* updatedAt damgası kaydetme anında vurulur (render saf kalır). */
  const patchDeck = (d: SlideDeck) => setDeck(d);
  const patchSlide = (patch: Partial<Slide>) => {
    if (!deck || !slide) return;
    patchDeck({ ...deck, slides: deck.slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)) });
  };

  const generate = async (text?: string) => {
    const b = (text ?? brief).trim();
    if (!b || busy) return;
    setBusy(true); setProgress(0);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const d = await generateDeck({
        brief: b, slideCount,
        onDelta: (t) => setProgress(t.length),
        signal: ac.signal,
      });
      d.themeId = themeId;
      setDeck(d); setSel(0); setView("work");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        const msg = e instanceof Error ? e.message : "bilinmeyen hata";
        addToast(`Sunum üretilemedi: ${msg}`, "error");
      }
    } finally { setBusy(false); abortRef.current = null; }
  };

  const addSlideAfter = () => {
    if (!deck) return;
    if (deck.slides.length >= MAX_SLIDES) { addToast(`En fazla ${MAX_SLIDES} slayt.`, "info"); return; }
    const s = newSlide("bullets");
    const slides = [...deck.slides];
    slides.splice(sel + 1, 0, s);
    patchDeck({ ...deck, slides });
    setSel(sel + 1);
  };

  const deleteSlide = () => {
    if (!deck || !slide || deck.slides.length <= 1) return;
    patchDeck({ ...deck, slides: deck.slides.filter((s) => s.id !== slide.id) });
    setSel((i) => Math.max(0, i - 1));
  };

  const moveSlide = (dir: -1 | 1) => {
    if (!deck) return;
    const j = sel + dir;
    if (j < 0 || j >= deck.slides.length) return;
    const slides = [...deck.slides];
    [slides[sel], slides[j]] = [slides[j], slides[sel]];
    patchDeck({ ...deck, slides });
    setSel(j);
  };

  /* Pollinations görseli: yeni seed → yeni varyasyon; URL slayta sabitlenir. */
  const genImage = () => {
    const p = slide?.imagePrompt?.trim();
    if (!p) { addToast("Önce 'Görsel betimi' alanına İngilizce bir sahne yaz.", "info"); return; }
    patchSlide({ imageUrl: pollinationsImageUrl(p, { width: 1280, height: 720, seed: Math.floor(Math.random() * 1_000_000) }) });
  };

  const rewrite = async () => {
    if (!deck || !slide || rewriteBusy) return;
    setRewriteBusy(true);
    try {
      const fresh = await rewriteSlide({ deck, index: sel, instruction: rewriteText.trim() });
      patchDeck({ ...deck, slides: deck.slides.map((s, i) => (i === sel ? { ...fresh, id: s.id } : s)) });
      setRewriteText("");
    } catch (e) {
      addToast(`Slayt yeniden yazılamadı: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setRewriteBusy(false); }
  };

  const narrate = () => {
    if (!slide) return;
    if (speaking) { stopTts(); setSpeaking(false); return; }
    const text = slideNarration(slide);
    if (!text) { addToast("Bu slaytta seslendirilecek metin yok.", "info"); return; }
    setSpeaking(true);
    playTts(text, voice, () => setSpeaking(false));
  };

  const saveDeck = () => {
    if (!deck) return;
    const stamped = { ...deck, updatedAt: Date.now() };
    setDeck(stamped);
    const existing = config.slideDecks ?? [];
    saveConfig({ ...config, slideDecks: [stamped, ...existing.filter((d) => d.id !== deck.id)].slice(0, 30) });
    addToast("Sunum kaydedildi.", "success");
  };

  const openDeck = (d: SlideDeck) => {
    stopTts(); setSpeaking(false);
    setDeck(d); setSel(0); setThemeId(d.themeId); setView("work"); setDecksOpen(false);
  };

  const removeDeck = (id: string) => {
    saveConfig({ ...config, slideDecks: (config.slideDecks ?? []).filter((d) => d.id !== id) });
  };

  const exportHtml = () => {
    if (!deck) return;
    downloadHtml(deckToHtml(deck), deck.title || "sunum");
  };

  const printPdf = () => {
    if (!deck) return;
    if (!printPdfDoc(deckToHtml(deck))) addToast("Açılır pencere engellendi — HTML indirip tarayıcıdan yazdır.", "error");
  };

  const newDeck = () => {
    stopTts(); setSpeaking(false);
    abortRef.current?.abort();
    setDeck(null); setView("home"); setBrief(""); setSel(0);
  };

  const savedDecks = config.slideDecks ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Üst bar — mod seçici + eylemler */}
      <StudioTopBar
        icon={Presentation}
        label="Sunum"
        activeSurface="slides"
        showWorkActions={view === "work" && !!deck}
        onNew={newDeck}
        onClose={() => nav.close()}
        title={deck ? { value: deck.title, onChange: (v) => patchDeck({ ...deck, title: v }), placeholder: "Sunum adı" } : undefined}
        actions={
          <>
            <button onClick={saveDeck} title="Kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
            <button onClick={exportHtml} title="Bağımsız HTML indir" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Download size={15} /></button>
            <button onClick={printPdf} title="Yazdır / PDF" className="hidden sm:grid w-8 h-8 place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Printer size={15} /></button>
            <button onClick={() => setPlayerOpen(true)} title="Sunumu başlat" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-[#111110] text-xs font-semibold hover:bg-branddim transition-colors"><MonitorPlay size={14} /> Sun</button>
          </>
        }
      />

      {view === "home" ? (
        /* ── Giriş: brief kartı ── */
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-20 flex flex-col gap-5">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Sunumu anlat, slaytları craft kursun</h1>
              <p className="text-muted text-sm mt-1.5 text-balance">Konu + hedef kitle yaz — kurgu, görseller ve konuşmacı notlarıyla deste hazır. Ücretsiz, anahtarsız.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
                rows={4}
                placeholder="Örn: Lise öğrencilerine iklim değişikliği sunumu — nedenler, etkiler, çözümler; umut veren bir kapanış."
                className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
              />
              <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
                <div className="flex items-center gap-0.5 bg-bgsoft border border-line rounded-lg p-0.5">
                  {COUNTS.map((n) => (
                    <button key={n} onClick={() => setSlideCount(n)} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${slideCount === n ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>{n} slayt</button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Tema">
                  {SLIDE_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      title={t.name}
                      aria-checked={themeId === t.id}
                      role="radio"
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${themeId === t.id ? "border-brand scale-110" : "border-line"}`}
                      style={{ background: `linear-gradient(135deg, ${t.bg} 55%, ${t.accent} 55%)` }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => void generate()}
                  disabled={busy || !brief.trim()}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Üret
                </button>
              </div>
            </div>
            {busy && <p className="text-center text-xs text-muted/60 animate-pulse">Sunum kurgulanıyor… ({progress} karakter)</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setBrief(s)} className="text-left text-[12.5px] leading-snug px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted/80">
              {savedDecks.length > 0 && (
                <button onClick={() => setDecksOpen(true)} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
                  <Presentation size={13} className="text-brand" /> Kayıtlı sunumlar ({savedDecks.length})
                </button>
              )}
              <button
                onClick={() => pickTemplateFile((t) => { if (t.kind === "deck") openDeck(t.data); else addToast("Bu dosya bir sunum şablonu değil.", "error"); }, (m) => addToast(m, "error"))}
                className="inline-flex items-center gap-1.5 hover:text-ink transition-colors"
              >
                <Download size={13} className="text-brand rotate-180" /> Şablon içe aktar (.json)
              </button>
            </div>
          </div>
        </div>
      ) : deck && slide ? (
        /* ── Çalışma alanı: filmstrip · sahne · düzenleyici ── */
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Filmstrip */}
          <div className="order-2 lg:order-1 shrink-0 lg:w-44 border-t lg:border-t-0 lg:border-r border-line/60 overflow-x-auto lg:overflow-y-auto p-2 flex lg:flex-col gap-2">
            {deck.slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSel(i)}
                className={`relative shrink-0 w-36 lg:w-full rounded-lg overflow-hidden border-2 transition-colors ${i === sel ? "border-brand" : "border-line/60 hover:border-line"}`}
                title={s.title || `Slayt ${i + 1}`}
              >
                <div className="pointer-events-none">
                  <SlideCanvas slide={s} theme={theme} />
                </div>
                <span className="absolute bottom-1 left-1.5 text-[10px] font-bold text-white/80 bg-black/40 rounded px-1">{i + 1}</span>
              </button>
            ))}
            <button onClick={addSlideAfter} className="shrink-0 w-36 lg:w-full aspect-video rounded-lg border-2 border-dashed border-line/60 hover:border-brand/50 grid place-items-center text-muted hover:text-brand transition-colors" title="Slayt ekle">
              <Plus size={18} />
            </button>
          </div>

          {/* Sahne */}
          <div className="order-1 lg:order-2 flex-1 min-w-0 min-h-0 flex flex-col items-center justify-center p-3 sm:p-6 bg-bgsoft/40">
            <div className="w-full max-w-4xl rounded-xl overflow-hidden elev-2 border border-line/60">
              <SlideCanvas slide={slide} theme={theme} />
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted/60">
              <span>{sel + 1} / {deck.slides.length}</span>
              <span className="hidden sm:inline">· ← → ile gezin</span>
            </div>
          </div>

          {/* Düzenleyici */}
          <div className="order-3 shrink-0 lg:w-80 border-t lg:border-t-0 lg:border-l border-line/60 overflow-y-auto p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <select
                value={slide.layout}
                onChange={(e) => patchSlide({ layout: e.target.value as SlideLayout })}
                className="flex-1 bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand/50 cursor-pointer"
                aria-label="Slayt düzeni"
              >
                {SLIDE_LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <button onClick={() => moveSlide(-1)} title="Yukarı taşı" className="w-7 h-7 grid place-items-center rounded-lg border border-line text-muted hover:text-ink"><ArrowUp size={13} /></button>
              <button onClick={() => moveSlide(1)} title="Aşağı taşı" className="w-7 h-7 grid place-items-center rounded-lg border border-line text-muted hover:text-ink"><ArrowDown size={13} /></button>
              <button onClick={deleteSlide} title="Slaytı sil" className="w-7 h-7 grid place-items-center rounded-lg border border-line text-muted hover:text-red"><Trash2 size={13} /></button>
            </div>

            <label className="block">
              <span className="text-[11px] text-muted/70 font-semibold">Başlık</span>
              <input value={slide.title ?? ""} onChange={(e) => patchSlide({ title: e.target.value })} className="mt-1 w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50" />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted/70 font-semibold">Alt başlık</span>
              <input value={slide.subtitle ?? ""} onChange={(e) => patchSlide({ subtitle: e.target.value || undefined })} className="mt-1 w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50" />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted/70 font-semibold">Maddeler (satır başına bir)</span>
              <textarea
                value={(slide.bullets ?? []).join("\n")}
                onChange={(e) => patchSlide({ bullets: e.target.value.split("\n").filter((b) => b.trim()).slice(0, 8) })}
                rows={4}
                className="mt-1 w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 resize-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted/70 font-semibold">Gövde metni</span>
              <textarea value={slide.body ?? ""} onChange={(e) => patchSlide({ body: e.target.value || undefined })} rows={2} className="mt-1 w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 resize-none" />
            </label>

            <div>
              <span className="text-[11px] text-muted/70 font-semibold">Görsel betimi (İngilizce · Pollinations)</span>
              <div className="mt-1 flex gap-1.5">
                <input value={slide.imagePrompt ?? ""} onChange={(e) => patchSlide({ imagePrompt: e.target.value || undefined, imageUrl: undefined })} placeholder="misty mountain sunrise, cinematic" className="flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50" />
                <button onClick={genImage} title="Yeni görsel varyasyonu üret" className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-line text-muted hover:text-brand hover:border-brand/50 transition-colors"><RefreshCw size={14} /></button>
              </div>
            </div>

            <label className="block">
              <span className="text-[11px] text-muted/70 font-semibold">Konuşmacı notları</span>
              <textarea value={slide.notes ?? ""} onChange={(e) => patchSlide({ notes: e.target.value || undefined })} rows={3} className="mt-1 w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 resize-none" />
            </label>

            {/* Seslendirme: Pollinations openai-audio (ücretsiz), tarayıcı yedeği. */}
            <div className="flex items-center gap-1.5">
              <button onClick={narrate} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${speaking ? "border-brand/50 text-brand bg-brand/10" : "border-line text-muted hover:text-ink hover:border-brand/40"}`}>
                {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />} {speaking ? "Durdur" : "Slaytı anlat"}
              </button>
              <select
                value={voice}
                onChange={(e) => saveConfig({ ...config, ttsVoice: e.target.value })}
                className="bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50 cursor-pointer"
                aria-label="Seslendirme sesi"
              >
                {TTS_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>

            {/* Tema değişimi — veri kayıpsız, anında. */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted/70 font-semibold">Tema</span>
              {SLIDE_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => patchDeck({ ...deck, themeId: t.id })}
                  title={t.name}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${deck.themeId === t.id ? "border-brand scale-110" : "border-line"}`}
                  style={{ background: `linear-gradient(135deg, ${t.bg} 55%, ${t.accent} 55%)` }}
                />
              ))}
            </div>

            {/* Tek slaytı AI ile yeniden yaz */}
            <div className="border-t border-line/60 pt-3">
              <div className="flex gap-1.5">
                <input
                  value={rewriteText}
                  onChange={(e) => setRewriteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void rewrite(); }}
                  placeholder="Örn: daha kısa ve çarpıcı yap"
                  className="flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50"
                />
                <button onClick={() => void rewrite()} disabled={rewriteBusy} title="Bu slaytı AI ile yeniden yaz" className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand/15 text-brand text-xs font-semibold hover:bg-brand/25 disabled:opacity-40 transition-colors">
                  {rewriteBusy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Yeniden yaz
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sunum modu — dışa aktarma HTML'i birebir (iframe srcDoc) */}
      {playerOpen && deck && (
        <div className="fixed inset-0 z-[80] bg-black">
          <iframe srcDoc={deckToHtml(deck)} title={deck.title} className="w-full h-full border-0" />
          <button onClick={() => setPlayerOpen(false)} className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors" title="Sunumdan çık (Esc)"><X size={18} /></button>
        </div>
      )}

      {/* Kayıtlı sunumlar */}
      <SavedItemsModal
        open={decksOpen}
        onClose={() => setDecksOpen(false)}
        title="Kayıtlı sunumlar"
        icon={Presentation}
        items={savedDecks}
        getKey={(d) => d.id}
        renderRow={(d) => (
          <>
            <div className="text-sm font-semibold truncate">{d.title}</div>
            <div className="text-[11px] text-muted/60">{d.slides.length} slayt · {new Date(d.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openDeck}
        onDelete={(d) => removeDeck(d.id)}
        onExportTemplate={(d) => downloadTemplate({ kind: "deck", data: d }, d.title)}
        emptyLabel="Henüz kayıtlı sunum yok."
      />
    </div>
  );
}
