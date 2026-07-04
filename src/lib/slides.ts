/* Sunum Stüdyosu çekirdeği — Google Slides'tan İLHAM alan (klonu değil) craft
   yorumu: LLM yapılandırılmış slayt JSON'u üretir, craft bunu deterministik
   temalarla render eder. Böylece her slayt düzenlenebilir veri olarak kalır
   (serbest HTML değil): tema değiştirmek, slayt eklemek, tek slaytı yeniden
   yazdırmak ve bağımsız HTML/PDF dışa aktarmak kayıpsızdır. */
import type { Slide, SlideDeck, SlideLayout } from "./types";
import { pollinationsImageUrl, stableSeed } from "./pollinations";

export interface SlideTheme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export const SLIDE_THEMES: SlideTheme[] = [
  { id: "gece", name: "Gece", bg: "#111110", surface: "#1c1c1a", ink: "#f4f2ec", muted: "#a8a396", accent: "#fbbf24", headingFont: SANS, bodyFont: SANS },
  { id: "kagit", name: "Kâğıt", bg: "#faf8f2", surface: "#ffffff", ink: "#1f1e1b", muted: "#6b675e", accent: "#b45309", headingFont: SANS, bodyFont: SANS },
  { id: "okyanus", name: "Okyanus", bg: "#0b1220", surface: "#131c30", ink: "#eef2ff", muted: "#93a0bd", accent: "#38bdf8", headingFont: SANS, bodyFont: SANS },
  { id: "akademi", name: "Akademi", bg: "#fffdf7", surface: "#ffffff", ink: "#232019", muted: "#6f6a5d", accent: "#166534", headingFont: SERIF, bodyFont: SANS },
];

export function slideThemeById(id: string | null | undefined): SlideTheme {
  return SLIDE_THEMES.find((t) => t.id === id) ?? SLIDE_THEMES[0];
}

export const SLIDE_LAYOUTS: { id: SlideLayout; name: string }[] = [
  { id: "cover", name: "Kapak" },
  { id: "section", name: "Bölüm başlığı" },
  { id: "bullets", name: "Madde listesi" },
  { id: "two-col", name: "İki sütun" },
  { id: "image", name: "Görsel odaklı" },
  { id: "quote", name: "Alıntı" },
  { id: "end", name: "Kapanış" },
];

export const MAX_SLIDES = 24;

export function newSlideId(): string {
  return `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newSlide(layout: SlideLayout = "bullets"): Slide {
  const base: Slide = { id: newSlideId(), layout };
  if (layout === "bullets" || layout === "two-col") base.bullets = ["Yeni madde"];
  base.title = "Yeni slayt";
  return base;
}

/** Slaytın görsel URL'i: sabitlenmiş imageUrl varsa o; yoksa imagePrompt'tan
    deterministik seed'le Pollinations URL'i (aynı prompt → aynı görsel). */
export function slideImageSrc(slide: Slide, width = 1280, height = 720): string | null {
  if (slide.imageUrl) return slide.imageUrl;
  const p = slide.imagePrompt?.trim();
  if (!p) return null;
  return pollinationsImageUrl(p, { width, height, seed: stableSeed(p), model: "flux" });
}

/* ── LLM çıktısını güvenli desteye çevirme ──────────────────────────── */

const VALID_LAYOUTS: SlideLayout[] = ["cover", "section", "bullets", "two-col", "image", "quote", "end"];

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function normalizeSlide(raw: unknown): Slide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const layout = VALID_LAYOUTS.includes(r.layout as SlideLayout) ? (r.layout as SlideLayout) : "bullets";
  const bullets = Array.isArray(r.bullets)
    ? r.bullets.filter((b): b is string => typeof b === "string" && !!b.trim()).map((b) => b.trim()).slice(0, 8)
    : undefined;
  const s: Slide = {
    id: newSlideId(),
    layout,
    title: asString(r.title),
    subtitle: asString(r.subtitle),
    bullets: bullets?.length ? bullets : undefined,
    body: asString(r.body),
    imagePrompt: asString(r.imagePrompt),
    notes: asString(r.notes),
  };
  if (!s.title && !s.bullets && !s.body) return null;
  return s;
}

/** Ham nesneyi doğrulanmış SlideDeck'e çevirir; kurtarılamazsa null. */
export function normalizeDeck(raw: unknown, fallbackTitle = "Sunum"): SlideDeck | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slides = (Array.isArray(r.slides) ? r.slides : [])
    .map(normalizeSlide)
    .filter((s): s is Slide => s !== null)
    .slice(0, MAX_SLIDES);
  if (!slides.length) return null;
  const now = Date.now();
  return {
    id: `deck_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: asString(r.title) ?? fallbackTitle,
    themeId: SLIDE_THEMES[0].id,
    slides,
    createdAt: now,
    updatedAt: now,
  };
}

/** LLM metninden JSON'u ayıklar: ```json çitleri veya ilk dengeli { } bloğu. */
export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  return null;
}

/** LLM yanıtından deste üretir; ayrıştırılamazsa Error fırlatır. */
export function parseDeckJson(text: string, fallbackTitle = "Sunum"): SlideDeck {
  const json = extractJson(text);
  if (!json) throw new Error("Sunum JSON'u bulunamadı — tekrar dene.");
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error("Sunum JSON'u bozuk — tekrar dene."); }
  const deck = normalizeDeck(raw, fallbackTitle);
  if (!deck) throw new Error("Sunumda kullanılabilir slayt yok — brief'i netleştir.");
  return deck;
}

/* ── Bağımsız HTML dışa aktarma (sunum + yazdırma/PDF) ──────────────── */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slideInnerHtml(s: Slide, t: SlideTheme): string {
  const img = slideImageSrc(s, 1280, 720);
  const title = s.title ? escapeHtml(s.title) : "";
  const subtitle = s.subtitle ? escapeHtml(s.subtitle) : "";
  const body = s.body ? escapeHtml(s.body) : "";
  const bullets = (s.bullets ?? []).map((b) => `<li>${escapeHtml(b)}</li>`).join("");
  switch (s.layout) {
    case "cover":
    case "end":
      return `<div class="center">
        ${img ? `<img class="coverimg" src="${escapeHtml(img)}" alt="">` : ""}
        <h1>${title}</h1>
        ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
      </div>`;
    case "section":
      return `<div class="center"><p class="kicker">— ${escapeHtml(t.name)} —</p><h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}</div>`;
    case "quote":
      return `<div class="center"><blockquote>“${body || title}”</blockquote>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}</div>`;
    case "image":
      return `<div class="imgwrap">${img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="imgph"></div>`}</div>
        <div class="imgcap"><h2>${title}</h2>${body ? `<p>${body}</p>` : ""}</div>`;
    case "two-col":
      return `<h2>${title}</h2><div class="cols"><ul>${bullets}</ul><div class="colbody">${body ? `<p>${body}</p>` : (img ? `<img src="${escapeHtml(img)}" alt="">` : "")}</div></div>`;
    case "bullets":
    default:
      return `<h2>${title}</h2>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}<ul>${bullets}</ul>${body ? `<p>${body}</p>` : ""}`;
  }
}

/** Desteyi tek, kendi kendine yeten sunum HTML'ine çevirir: ok tuşları/tıkla
    ile gezinme, ilerleme çubuğu, nokta göstergesi, N ile konuşmacı notları,
    yazdırınca slayt-başına-sayfa (PDF). Ağ bağımlılığı yalnız görseller. */
export function deckToHtml(deck: SlideDeck): string {
  const t = slideThemeById(deck.themeId);
  const slides = deck.slides.map((s, i) => `<section class="slide" data-i="${i}">
    ${slideInnerHtml(s, t)}
    ${s.notes ? `<aside class="notes">${escapeHtml(s.notes)}</aside>` : ""}
  </section>`).join("\n");
  const dots = deck.slides.map((_, i) => `<i data-i="${i}"></i>`).join("");
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(deck.title)}</title>
<style>
  :root { --bg:${t.bg}; --surface:${t.surface}; --ink:${t.ink}; --muted:${t.muted}; --accent:${t.accent}; }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--ink); font-family: ${t.bodyFont}; overflow: hidden; }
  .slide { position: absolute; inset: 0; display: none; flex-direction: column; justify-content: center;
           padding: 6vmin 9vmin; background: var(--bg); }
  .slide.on { display: flex; }
  h1 { font-family: ${t.headingFont}; font-size: 7vmin; line-height: 1.1; letter-spacing: -0.02em; }
  h2 { font-family: ${t.headingFont}; font-size: 5vmin; line-height: 1.15; margin-bottom: 3vmin; }
  h2::after { content: ""; display: block; width: 8vmin; height: 4px; background: var(--accent); margin-top: 1.6vmin; border-radius: 2px; }
  .sub { color: var(--muted); font-size: 2.8vmin; margin-top: 2vmin; max-width: 60ch; }
  .kicker { color: var(--accent); font-size: 2vmin; letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 2vmin; }
  ul { list-style: none; display: grid; gap: 2.2vmin; font-size: 3.2vmin; max-width: 75ch; }
  li { padding-left: 3.6vmin; position: relative; line-height: 1.35; }
  li::before { content: ""; position: absolute; left: 0; top: 1.1vmin; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; background: var(--accent); }
  p { font-size: 2.9vmin; line-height: 1.5; max-width: 70ch; margin-top: 2vmin; }
  blockquote { font-family: ${t.headingFont}; font-size: 5vmin; line-height: 1.3; max-width: 30ch; }
  .center { display: grid; justify-items: start; align-content: center; height: 100%; }
  .coverimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.22; z-index: -1; }
  .imgwrap { flex: 1; min-height: 0; border-radius: 1.5vmin; overflow: hidden; background: var(--surface); }
  .imgwrap img { width: 100%; height: 100%; object-fit: cover; }
  .imgph { width: 100%; height: 100%; background: linear-gradient(135deg, var(--surface), var(--bg)); }
  .imgcap { padding-top: 2.5vmin; }
  .imgcap h2 { font-size: 3.6vmin; margin-bottom: 0; } .imgcap h2::after { display: none; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 5vmin; align-items: start; }
  .colbody img { width: 100%; border-radius: 1.5vmin; }
  .notes { display: none; position: absolute; left: 3vmin; right: 3vmin; bottom: 8vmin; background: var(--surface);
           color: var(--muted); border-left: 4px solid var(--accent); padding: 2vmin 2.5vmin; font-size: 2vmin;
           border-radius: 1vmin; box-shadow: 0 1vmin 4vmin rgb(0 0 0 / .3); }
  body.shownotes .slide.on .notes { display: block; }
  #bar { position: fixed; left: 0; top: 0; height: 3px; background: var(--accent); width: 0; transition: width .25s; z-index: 3; }
  #dots { position: fixed; bottom: 2.4vmin; left: 50%; transform: translateX(-50%); display: flex; gap: 1.2vmin; z-index: 3; }
  #dots i { width: 1.2vmin; height: 1.2vmin; border-radius: 50%; background: var(--muted); opacity: .4; cursor: pointer; }
  #dots i.on { background: var(--accent); opacity: 1; }
  #hint { position: fixed; right: 2vmin; bottom: 2vmin; color: var(--muted); font-size: 1.7vmin; opacity: .6; z-index: 3; }
  @media print {
    body { overflow: visible; }
    .slide { position: relative; display: flex !important; height: 100vh; page-break-after: always; }
    #bar, #dots, #hint, .notes { display: none !important; }
  }
</style>
</head>
<body>
<div id="bar"></div>
${slides}
<div id="dots">${dots}</div>
<div id="hint">← → gezin · N notlar</div>
<script>
(function () {
  var slides = document.querySelectorAll(".slide");
  var dots = document.querySelectorAll("#dots i");
  var bar = document.getElementById("bar");
  var cur = 0;
  function show(i) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    for (var k = 0; k < slides.length; k++) {
      slides[k].classList.toggle("on", k === cur);
      dots[k].classList.toggle("on", k === cur);
    }
    bar.style.width = ((cur + 1) / slides.length * 100) + "%";
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") show(cur + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") show(cur - 1);
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides.length - 1);
    else if (e.key.toLowerCase() === "n") document.body.classList.toggle("shownotes");
  });
  document.addEventListener("click", function (e) {
    var d = e.target && e.target.closest ? e.target.closest("#dots i") : null;
    if (d) { show(parseInt(d.getAttribute("data-i"), 10)); return; }
    show(cur + 1);
  });
  show(0);
})();
</script>
</body>
</html>`;
}

/** Slaytın seslendirilecek metni: notlar varsa notlar, yoksa başlık + maddeler. */
export function slideNarration(s: Slide): string {
  if (s.notes?.trim()) return s.notes.trim();
  const parts = [s.title, s.subtitle, ...(s.bullets ?? []), s.body].filter(Boolean);
  return parts.join(". ");
}
