/* Sunum Stüdyosu çekirdeği — Google Slides'tan İLHAM alan (klonu değil) Umai
   yorumu: LLM yapılandırılmış slayt JSON'u üretir, Umai bunu deterministik
   temalarla render eder. Böylece her slayt düzenlenebilir veri olarak kalır
   (serbest HTML değil): tema değiştirmek, slayt eklemek, tek slaytı yeniden
   yazdırmak ve bağımsız HTML/PDF dışa aktarmak kayıpsızdır. */
import type { Slide, SlideDeck, SlideLayout, SlideStat } from "./types";
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
  /** Opsiyonel — verilirse slayt arka planı düz `bg` yerine bu CSS gradyanını
      kullanır (eski temalar bunu ayarlamaz → davranışları değişmez). */
  bgGradient?: string;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export const SLIDE_THEMES: SlideTheme[] = [
  { id: "gece", name: "Gece", bg: "#111110", surface: "#1c1c1a", ink: "#f4f2ec", muted: "#a8a396", accent: "#fbbf24", headingFont: SANS, bodyFont: SANS },
  { id: "kagit", name: "Kâğıt", bg: "#faf8f2", surface: "#ffffff", ink: "#1f1e1b", muted: "#6b675e", accent: "#b45309", headingFont: SANS, bodyFont: SANS },
  { id: "okyanus", name: "Okyanus", bg: "#0b1220", surface: "#131c30", ink: "#eef2ff", muted: "#93a0bd", accent: "#38bdf8", headingFont: SANS, bodyFont: SANS },
  { id: "akademi", name: "Akademi", bg: "#fffdf7", surface: "#ffffff", ink: "#232019", muted: "#6f6a5d", accent: "#166534", headingFont: SERIF, bodyFont: SANS },
  { id: "gunbatimi", name: "Gün Batımı", bg: "#1a0f1f", surface: "#2b1830", ink: "#fdf2f8", muted: "#d8b4d0", accent: "#fb7185", headingFont: SANS, bodyFont: SANS, bgGradient: "linear-gradient(135deg, #1a0f1f 0%, #3b1d4a 50%, #7c2d4a 100%)" },
  { id: "orman", name: "Orman", bg: "#0d1f17", surface: "#16291f", ink: "#eef7f0", muted: "#9cbfa9", accent: "#34d399", headingFont: SERIF, bodyFont: SANS, bgGradient: "linear-gradient(160deg, #0d1f17 0%, #123524 60%, #1d4a34 100%)" },
  { id: "neon", name: "Neon", bg: "#0a0a12", surface: "#151521", ink: "#f5f3ff", muted: "#a5a3c7", accent: "#a855f7", headingFont: SANS, bodyFont: SANS, bgGradient: "linear-gradient(135deg, #0a0a12 0%, #1b1030 45%, #2d1b4e 100%)" },
  { id: "mercan", name: "Mercan", bg: "#fff5f0", surface: "#ffffff", ink: "#2a1810", muted: "#8a6a56", accent: "#ea580c", headingFont: SERIF, bodyFont: SANS, bgGradient: "linear-gradient(135deg, #fff5f0 0%, #ffe8d9 100%)" },
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
  { id: "stats", name: "İstatistik" },
  { id: "end", name: "Kapanış" },
];

export const MAX_SLIDES = 24;

export function newSlideId(): string {
  return `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newSlide(layout: SlideLayout = "bullets"): Slide {
  const base: Slide = { id: newSlideId(), layout };
  if (layout === "bullets" || layout === "two-col") base.bullets = ["Yeni madde"];
  if (layout === "stats") base.stats = [{ value: "0", label: "Etiket" }];
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

/* ── Kalite denetimi (danışma niteliğinde) ────────────────────────────
   studioCraft.ts'teki lintArtifact() ile AYNI konsept (üretimi engellemez,
   yalnız kullanıcıya "şunu kontrol et" notu düşer) — ama HTML'e özgü
   kontroller (hex renk sayısı, viewport meta) yerine deste ŞEMASINA özgü
   kontroller: DECK_SCHEMA'nın kendi kurallarına (ilk slayt cover/son end,
   madde ≤12 kelime, her slaytta konuşmacı notu) ne kadar uyulduğu. */
const MAX_BULLET_WORDS = 14; // şema "≤12 kelime" ister, biraz pay bırakılır
const MAX_BULLETS_COMFORTABLE = 6; // normalizeSlide zaten 8'de kesiyor; 6+ zaten kalabalık

export function lintDeck(deck: SlideDeck): string[] {
  const warnings: string[] = [];
  const n = deck.slides.length;
  if (n === 0) return warnings;

  if (deck.slides[0]?.layout !== "cover") warnings.push("ilk slayt kapak (cover) değil");
  if (deck.slides[n - 1]?.layout !== "end") warnings.push("son slayt kapanış (end) değil");

  const missingNotes = deck.slides.filter((s) => !s.notes?.trim()).length;
  if (missingNotes > 0) warnings.push(`${missingNotes} slaytta konuşmacı notu eksik`);

  const longBullets = deck.slides.some((s) => (s.bullets ?? []).some((b) => b.split(/\s+/).filter(Boolean).length > MAX_BULLET_WORDS));
  if (longBullets) warnings.push("bazı maddeler çok uzun — slaytta okunması zor olabilir");

  const crowded = deck.slides.filter((s) => (s.bullets?.length ?? 0) > MAX_BULLETS_COMFORTABLE).length;
  if (crowded > 0) warnings.push(`${crowded} slaytta çok fazla madde var`);

  const allText = deck.slides.map((s) => `${s.title ?? ""} ${s.body ?? ""}`).join(" ");
  if (/lorem ipsum/i.test(allText)) warnings.push("Lorem ipsum kalmış — gerçek içerik bekleniyordu");

  return warnings;
}

/* ── LLM çıktısını güvenli desteye çevirme ──────────────────────────── */

const VALID_LAYOUTS: SlideLayout[] = ["cover", "section", "bullets", "two-col", "image", "quote", "stats", "end"];

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function normalizeStats(v: unknown): SlideStat[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const stats = v
    .map((item): SlideStat | null => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const value = asString(r.value);
      const label = asString(r.label);
      return value && label ? { value, label } : null;
    })
    .filter((s): s is SlideStat => s !== null)
    .slice(0, 4);
  return stats.length ? stats : undefined;
}

function normalizeSlide(raw: unknown): Slide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const layout = VALID_LAYOUTS.includes(r.layout as SlideLayout) ? (r.layout as SlideLayout) : "bullets";
  const bullets = Array.isArray(r.bullets)
    ? r.bullets.filter((b): b is string => typeof b === "string" && !!b.trim()).map((b) => b.trim()).slice(0, 8)
    : undefined;
  const stats = normalizeStats(r.stats);
  const s: Slide = {
    id: newSlideId(),
    layout,
    title: asString(r.title),
    subtitle: asString(r.subtitle),
    bullets: bullets?.length ? bullets : undefined,
    body: asString(r.body),
    stats,
    imagePrompt: asString(r.imagePrompt),
    notes: asString(r.notes),
  };
  if (!s.title && !s.bullets && !s.body && !s.stats) return null;
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

/* Pollinations üretim görselleri ağa bağımlı ve bazen yavaş/hatalı olabiliyor
   (yavaş üretim, ara sıra 5xx). Ham <img> başarısız olursa kırık-resim ikonu
   ASLA görünmemeli.

   Eskiden yalnız "image" düzeni gradyan yer tutucuya (.imgph) düşüyordu;
   diğer beş düzen görseli sessizce YOK EDİYORDU. Sonuç, render testinde
   ölçüldü: görsel yüklenmeyince kapak slaytı çıplak metne dönüyor, iki-sütun
   düzeninin sağ sütunu tamamen boşalıyor — yani kompozisyonda delik kalıyor.
   Artık her görsel bir yer tutucuya düşüyor: dekoratif kapak fonu .coverph'e,
   akış içindeki içerik görselleri .imgph.inline'a. */
const IMG_FALLBACK_ONERROR = `onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"`;

/** Dekoratif kapak fonu + başarısızlık yedeği (fon her zaman -1 katmanında). */
function coverImgHtml(img: string): string {
  return `<img class="coverimg" src="${escapeHtml(img)}" alt="" ${IMG_FALLBACK_ONERROR}><div class="coverph" style="display:none"></div>`;
}

/** Akış içindeki içerik görseli + gradyan yer tutucu yedeği. */
function inlineImgHtml(img: string): string {
  return `<img src="${escapeHtml(img)}" alt="" ${IMG_FALLBACK_ONERROR}><div class="imgph inline" style="display:none"></div>`;
}

/* Madde başına ikon (G4): fragile bir icon-adı→SVG eşlemesi yerine, LLM'e
   maddenin başına ilgili TEK bir emoji eklettiriyoruz (deckSystem, slidesGen.ts)
   — burada o baştaki emoji tespit edilip ayrı bir <span> rozetine taşınır,
   geri kalan metin normal escapeHtml'den geçer. Emoji yoksa eski nokta
   işaretleyici (li::before) değişmeden kalır. */
const EMOJI_LEAD_RE = /^(\p{Extended_Pictographic}️?)\s*/u;

function bulletItemHtml(b: string): string {
  const m = b.match(EMOJI_LEAD_RE);
  if (m) {
    const rest = b.slice(m[0].length);
    return `<li class="hasicon"><span class="bicon">${m[1]}</span>${escapeHtml(rest)}</li>`;
  }
  return `<li>${escapeHtml(b)}</li>`;
}

function slideInnerHtml(s: Slide, t: SlideTheme): string {
  const img = slideImageSrc(s, 1280, 720);
  const title = s.title ? escapeHtml(s.title) : "";
  const subtitle = s.subtitle ? escapeHtml(s.subtitle) : "";
  const body = s.body ? escapeHtml(s.body) : "";
  const bullets = (s.bullets ?? []).map(bulletItemHtml).join("");
  switch (s.layout) {
    case "cover":
    case "end":
      return `<div class="center">
        ${img ? coverImgHtml(img) : ""}
        <h1>${title}</h1>
        ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
      </div>`;
    case "section":
      return `<div class="center">
        ${img ? coverImgHtml(img) : ""}
        <p class="kicker">— ${escapeHtml(t.name)} —</p><h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
      </div>`;
    case "quote":
      return `<div class="center">
        ${img ? coverImgHtml(img) : ""}
        <blockquote>“${body || title}”</blockquote>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
      </div>`;
    case "image":
      return `<div class="imgwrap">${img
        ? `<img src="${escapeHtml(img)}" alt="" ${IMG_FALLBACK_ONERROR}><div class="imgph" style="display:none"></div>`
        : `<div class="imgph"></div>`}</div>
        <div class="imgcap"><h2>${title}</h2>${body ? `<p>${body}</p>` : ""}</div>`;
    case "two-col": {
      /* İki hata birden düzeltildi (render testinde yakalandı):
         1) `subtitle` hesaplanıyor ama HTML'e HİÇ basılmıyordu — LLM alt
            başlık yazdıysa sessizce kayboluyordu.
         2) Madde yoksa boş bir `<ul>` basılıyor, 1fr/1fr ızgarada kocaman
            boş bir sol sütun bırakıyordu. Artık tek sütuna iniyor. */
      const left = bullets ? `<ul>${bullets}</ul>` : "";
      const imgHtml = img ? inlineImgHtml(img) : "";
      const bodyHtml = body ? `<p>${body}</p>` : "";
      const cols = left && (imgHtml || bodyHtml)
        /* İki sütun: sol madde, sağ görsel+metin. */
        ? `<div class="cols"><div>${left}</div><div class="colbody">${imgHtml}${bodyHtml}</div></div>`
        /* Tek sütun: görsel metnin ARDINDAN gelir — aksi halde görsel alt
           başlıkla gövde metninin arasına girip okuma akışını kesiyordu. */
        : `<div class="colbody onecol">${left}${bodyHtml}${imgHtml}</div>`;
      return `<h2>${title}</h2>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}${cols}`;
    }
    case "stats": {
      const cards = (s.stats ?? []).map((it) => `<div class="statcard"><div class="statval">${escapeHtml(it.value)}</div><div class="statlabel">${escapeHtml(it.label)}</div></div>`).join("");
      return `<h2>${title}</h2>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}<div class="statgrid">${cards}</div>${body ? `<p>${body}</p>` : ""}`;
    }
    case "bullets":
    default:
      /* Madde slaytı görsele sahipse iki-sütun benzeri bir düzene geçer
         (G1: her slaytta görsel garantisi) — düz metin listesi yerine
         daha zengin/dolu bir görünüm. */
      if (img) {
        return `<div class="cols"><div><h2>${title}</h2>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}<ul>${bullets}</ul>${body ? `<p>${body}</p>` : ""}</div><div class="colbody">${inlineImgHtml(img)}</div></div>`;
      }
      return `<h2>${title}</h2>${subtitle ? `<p class="sub">${subtitle}</p>` : ""}<ul>${bullets}</ul>${body ? `<p>${body}</p>` : ""}`;
  }
}

export type SlideDensity = "roomy" | "normal" | "dense";

/** Slaytın ne kadar "dolu" olduğunu ölçer — tipografi ölçeği (--s) buna göre
    seçilir. Saf fonksiyon: yalnız slayt verisine bakar, DOM ölçümü yapmaz,
    böylece hem dışa aktarılan HTML hem birim testler aynı sonucu verir.
    Eşikler render testiyle kalibre edildi: 6+ madde ya da ~560 karakterden
    sonra 1280x720'de büyük ölçek taşmaya başlıyor. */
export function slideDensity(s: Slide): SlideDensity {
  const bullets = s.bullets ?? [];
  const stats = s.stats ?? [];
  const chars =
    (s.title?.length ?? 0) +
    (s.subtitle?.length ?? 0) +
    (s.body?.length ?? 0) +
    bullets.reduce((n, b) => n + b.length, 0) +
    stats.reduce((n, it) => n + it.value.length + it.label.length, 0);
  if (bullets.length >= 6 || stats.length >= 5 || chars > 560) return "dense";
  if (bullets.length <= 3 && stats.length <= 3 && chars < 260) return "roomy";
  return "normal";
}

/** Desteyi tek, kendi kendine yeten sunum HTML'ine çevirir: ok tuşları/tıkla
    ile gezinme, ilerleme çubuğu, nokta göstergesi, N ile konuşmacı notları,
    yazdırınca slayt-başına-sayfa (PDF). Ağ bağımlılığı yalnız görseller. */
export function deckToHtml(deck: SlideDeck): string {
  const t = slideThemeById(deck.themeId);
  const slides = deck.slides.map((s, i) => `<section class="slide" data-i="${i}" data-density="${slideDensity(s)}">
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
  /* isolation:isolate ŞART. .slide kendi yığın bağlamını KURMAZSA içindeki
     z-index:-1 katmanları (.coverimg, .coverph) slaytın KENDİ arka planının
     ARKASINA boyanıyor ve hiç görünmüyordu — yani kapak/bölüm/alıntı
     görselleri baştan beri ekrana hiç çıkmamış. Playwright'ta düz kırmızı bir
     test katmanıyla doğrulandı: izolasyon olmadan görünmüyor, varken görünüyor. */
  .slide { --s: 1; isolation: isolate; position: absolute; inset: 0; display: none; flex-direction: column; justify-content: center;
           padding: 6vmin 9vmin; background: ${t.bgGradient ? t.bgGradient : "var(--bg)"}; }
  .slide[data-density="roomy"] { --s: 1.12; }
  .slide[data-density="dense"] { --s: 0.84; }
  .slide.on { display: flex; }
  /* Tipografi ölçeği içeriğe göre uyarlanır (--s). Sabit ölçek, projeksiyon
     için fazla küçük kalıyordu (1280x720'de h1 yalnız 50px; Gamma/Beautiful.ai
     kapak başlıkları 64-80px bandında). Ölçeği tek başına büyütmek yoğun
     slaytları taşırırdı; bu yüzden slayt başına yoğunluk ölçülüp (deckToHtml,
     slideDensity) taban ölçek seyrek slaytta büyütülüyor, yoğun slaytta eski
     boyuta iniyor — böylece taşma riski artmadan tipografi büyüdü. */
  h1 { font-family: ${t.headingFont}; font-size: calc(9vmin * var(--s)); line-height: 1.08; letter-spacing: -0.02em; }
  h2 { font-family: ${t.headingFont}; font-size: calc(6.2vmin * var(--s)); line-height: 1.15; margin-bottom: 3vmin; }
  h2::after { content: ""; display: block; width: 8vmin; height: 4px; background: var(--accent); margin-top: 1.6vmin; border-radius: 2px; }
  .sub { color: var(--muted); font-size: calc(3.1vmin * var(--s)); margin-top: 2vmin; max-width: 60ch; }
  .kicker { color: var(--accent); font-size: calc(2.2vmin * var(--s)); letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 2vmin; }
  ul { list-style: none; display: grid; gap: 2.2vmin; font-size: calc(3.7vmin * var(--s)); max-width: 75ch; }
  li { padding-left: 3.6vmin; position: relative; line-height: 1.35; }
  li::before { content: ""; position: absolute; left: 0; top: 1.1vmin; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; background: var(--accent); }
  li.hasicon { padding-left: 4.6vmin; }
  li.hasicon::before { content: none; }
  .bicon { position: absolute; left: 0; top: -0.1vmin; font-size: calc(3.9vmin * var(--s)); line-height: 1; }
  p { font-size: calc(3.2vmin * var(--s)); line-height: 1.5; max-width: 70ch; margin-top: 2vmin; }
  blockquote { font-family: ${t.headingFont}; font-size: calc(6vmin * var(--s)); line-height: 1.3; max-width: 30ch; }
  .center { display: grid; justify-items: start; align-content: center; height: 100%; }
  .coverimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.22; z-index: -1; }
  /* Kapak görseli yüklenemezse fon çıplak kalmasın (kompozisyon deliği). */
  .coverph { position: absolute; inset: 0; z-index: -1; background: linear-gradient(135deg, var(--surface), var(--bg)); }
  .coverph::after { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 60% at 78% 18%, var(--accent), transparent 62%); opacity: .18; }
  .imgwrap { flex: 1; min-height: 0; border-radius: 1.5vmin; overflow: hidden; background: var(--surface); }
  .imgwrap img { width: 100%; height: 100%; object-fit: cover; }
  .imgph { width: 100%; height: 100%; position: relative; overflow: hidden; background: linear-gradient(135deg, var(--surface), var(--bg)); }
  .imgph::after { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 60% at 70% 25%, var(--accent), transparent 62%); opacity: .16; }
  /* Akış içindeki (sütun) görseli ve yedeği — yükseklik slayta göre SINIRLI.
     En-boy oranına bırakılırsa tek sütunlu two-col'da görsel slayt genişliğini
     alıp 700px'i aşıyor (render testinde ölçüldü: 911px > 677px sınır).
     Aynı sınır gerçek görselde de gerekli: dikey bir Pollinations çıktısı
     aksi halde düzeni taşırırdı. */
  .colbody img { max-height: 42vmin; object-fit: cover; }
  .imgph.inline { width: 100%; height: 34vmin; border-radius: 1.5vmin; }
  /* Madde yokken two-col tek sütuna iner — görsel tüm genişliği kaplamamalı. */
  .onecol { display: grid; gap: 2vmin; }
  .onecol img, .onecol .imgph.inline { max-width: 54vmin; }
  .imgcap { padding-top: 2.5vmin; }
  .imgcap h2 { font-size: calc(4vmin * var(--s)); margin-bottom: 0; } .imgcap h2::after { display: none; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 5vmin; align-items: center; }
  .colbody img { width: 100%; border-radius: 1.5vmin; }
  .statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(18vmin, 1fr)); gap: 3vmin; margin-top: 2vmin; }
  .statcard { background: var(--surface); border-radius: 1.5vmin; padding: 3vmin 2vmin; text-align: center; }
  .statval { font-family: ${t.headingFont}; font-size: calc(7vmin * var(--s)); font-weight: 700; color: var(--accent); line-height: 1; }
  .statlabel { color: var(--muted); font-size: calc(2.4vmin * var(--s)); margin-top: 1.2vmin; }
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
    .slide { position: relative; display: flex !important; height: 100vh; }
    /* Son slaytta sayfa-sonu YOK — aksi halde PDF'in sonunda fazladan boş bir sayfa kalır. */
    .slide:not(:last-child) { page-break-after: always; }
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
