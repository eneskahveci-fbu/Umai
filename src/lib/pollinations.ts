/* Pollinations entegrasyon merkezi — craft'ın ücretsiz, anahtarsız AI tabanı.
   Metin (text.pollinations.ai) zaten varsayılan/fallback sağlayıcı olarak gömülü
   (constants.ts, fallback.ts). Bu modül kalan yetenekleri TEK yerden sunar:
   - Görsel üretimi: URL kurucusu + canlı model kataloğu (GET /models)
   - Seslendirme (TTS): openai-audio modeli, ses seçimi, tarayıcı yedeği
   Anahtar gerekmez; URL'ler doğrudan <img>/<audio> ile yüklenir. */

export const POLLINATIONS_IMAGE_BASE = "https://image.pollinations.ai";
export const POLLINATIONS_TEXT_BASE = "https://text.pollinations.ai";
export const POLLINATIONS_REFERRER = "craft-coder";

/* ── Görsel üretimi ─────────────────────────────────────────────────── */

export interface PollinationsImageOptions {
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  /** Pollinations prompt'u zenginleştirsin (daha kaliteli görsel). */
  enhance?: boolean;
  /** Üretilen görsel herkese açık akışa (feed) düşmesin. */
  privateImage?: boolean;
}

export function pollinationsImageUrl(prompt: string, opts: PollinationsImageOptions = {}): string {
  const { model = "flux", width = 1024, height = 1024, seed, enhance = true, privateImage = true } = opts;
  const p = new URLSearchParams();
  p.set("width", String(width));
  p.set("height", String(height));
  p.set("model", model);
  if (seed !== undefined) p.set("seed", String(seed));
  p.set("nologo", "true");
  if (enhance) p.set("enhance", "true");
  if (privateImage) p.set("private", "true");
  p.set("referrer", POLLINATIONS_REFERRER);
  return `${POLLINATIONS_IMAGE_BASE}/prompt/${encodeURIComponent(prompt)}?${p.toString()}`;
}

/** Aynı prompt her render'da aynı görseli versin diye deterministik seed. */
export function stableSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 1_000_000;
}

export interface ImageModelInfo { id: string; label: string; }

/* Bilinen modellere Türkçe etiket; katalogda yeni gelenler ham adıyla listelenir. */
const IMAGE_MODEL_LABELS: Record<string, string> = {
  "flux": "Flux — kaliteli",
  "turbo": "Turbo — hızlı",
  "flux-realism": "Realism — foto-gerçekçi",
  "flux-anime": "Anime — çizgi",
  "flux-3d": "3D — render",
  "any-dark": "Any Dark — sanatsal",
  "gptimage": "GPT Image — çok yönlü",
  "kontext": "Kontext — bağlam düzenleme",
};

export const IMAGE_MODEL_FALLBACK: ImageModelInfo[] = [
  { id: "flux", label: IMAGE_MODEL_LABELS["flux"] },
  { id: "turbo", label: IMAGE_MODEL_LABELS["turbo"] },
  { id: "flux-realism", label: IMAGE_MODEL_LABELS["flux-realism"] },
  { id: "flux-anime", label: IMAGE_MODEL_LABELS["flux-anime"] },
  { id: "flux-3d", label: IMAGE_MODEL_LABELS["flux-3d"] },
  { id: "any-dark", label: IMAGE_MODEL_LABELS["any-dark"] },
];

let imageModelsCache: ImageModelInfo[] | null = null;

/** Canlı görsel model kataloğu (GET image.pollinations.ai/models).
    Ulaşılamazsa küratörlü yedek liste döner; başarılı sonuç oturum boyunca önbellekte. */
export async function fetchImageModels(): Promise<ImageModelInfo[]> {
  if (imageModelsCache) return imageModelsCache;
  try {
    const res = await fetch(`${POLLINATIONS_IMAGE_BASE}/models`, { headers: { Accept: "application/json" } });
    if (!res.ok) return IMAGE_MODEL_FALLBACK;
    const data: unknown = await res.json();
    const ids = Array.isArray(data) ? data.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
    if (!ids.length) return IMAGE_MODEL_FALLBACK;
    /* Küratörlü sırayı koru, katalogda olup listemizde olmayanları sona ekle. */
    const known = IMAGE_MODEL_FALLBACK.filter((m) => ids.includes(m.id));
    const extra = ids.filter((id) => !known.some((m) => m.id === id)).map((id) => ({ id, label: IMAGE_MODEL_LABELS[id] ?? id }));
    imageModelsCache = [...known, ...extra];
    return imageModelsCache;
  } catch {
    return IMAGE_MODEL_FALLBACK;
  }
}

/* ── Seslendirme (TTS) ──────────────────────────────────────────────── */

export interface TtsVoice { id: string; label: string; }

export const TTS_VOICES: TtsVoice[] = [
  { id: "nova", label: "Nova — sıcak" },
  { id: "alloy", label: "Alloy — dengeli" },
  { id: "echo", label: "Echo — derin" },
  { id: "fable", label: "Fable — hikâyeci" },
  { id: "onyx", label: "Onyx — bas" },
  { id: "shimmer", label: "Shimmer — parlak" },
];

/** GET URL uzunluk sınırı içinde güvenli metin uzunluğu. */
export const TTS_MAX_CHARS = 900;

export function pollinationsTtsUrl(text: string, voice = "nova"): string {
  const t = text.trim().slice(0, TTS_MAX_CHARS);
  const p = new URLSearchParams();
  p.set("model", "openai-audio");
  p.set("voice", voice);
  p.set("referrer", POLLINATIONS_REFERRER);
  return `${POLLINATIONS_TEXT_BASE}/${encodeURIComponent(t)}?${p.toString()}`;
}

/** Markdown'ı seslendirilebilir düz metne indirger (kod blokları atlanır). */
export function speakableText(md: string): string {
  return md
    .replace(/```[\s\S]*?(```|$)/g, " (kod bloğu) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>|~-]{1,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let currentAudio: HTMLAudioElement | null = null;

/** Çalan seslendirmeyi durdurur (Pollinations sesi + tarayıcı yedeği). */
export function stopTts(): void {
  if (currentAudio) { currentAudio.pause(); currentAudio.src = ""; currentAudio = null; }
  if (typeof window !== "undefined") { try { window.speechSynthesis?.cancel(); } catch { /* yok say */ } }
}

/* Pollinations erişilemezse tarayıcının yerleşik sesiyle oku (çevrimdışı yedek). */
function speakWithBrowser(text: string, onEnd?: () => void): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    window.speechSynthesis.speak(u);
  } catch { onEnd?.(); }
}

/** Metni Pollinations openai-audio ile seslendirir; hata olursa tarayıcı
    sesine düşer. Yeni çağrı öncekini keser. Yalnızca istemcide çağrılmalı. */
export function playTts(text: string, voice = "nova", onEnd?: () => void): void {
  if (typeof window === "undefined") return;
  stopTts();
  const clean = text.trim();
  if (!clean) { onEnd?.(); return; }
  const audio = new Audio(pollinationsTtsUrl(clean, voice));
  currentAudio = audio;
  const finish = () => { if (currentAudio === audio) currentAudio = null; onEnd?.(); };
  audio.onended = finish;
  audio.onerror = () => { if (currentAudio === audio) currentAudio = null; speakWithBrowser(clean, onEnd); };
  void audio.play().catch(() => { if (currentAudio === audio) currentAudio = null; speakWithBrowser(clean, onEnd); });
}
