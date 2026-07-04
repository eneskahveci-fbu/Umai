/* Sunum üretim motoru — brief → yapılandırılmış slayt JSON'u → SlideDeck.
   studioGen ile aynı altyapıyı kullanır (/api/chat + fallback zinciri), ama
   çıktı serbest HTML değil ŞEMALI JSON'dur: slides.ts doğrular ve render eder.
   Anahtarsız kullanıcıda zincir ücretsiz Pollinations'a düşer → hep çalışır. */
import { useStore } from "./store";
import { buildFallbackChain } from "./fallback";
import { resolveKey } from "./studioGen";
import { parseDeckJson } from "./slides";
import type { Slide, SlideDeck } from "./types";

const DECK_SCHEMA =
  '{"title": "sunum başlığı", "slides": [{"layout": "cover|section|bullets|two-col|image|quote|end", ' +
  '"title": "≤8 kelime", "subtitle": "opsiyonel kısa alt başlık", "bullets": ["en fazla 5 madde, her biri ≤12 kelime"], ' +
  '"body": "opsiyonel kısa paragraf", "imagePrompt": "opsiyonel — İngilizce görsel sahne betimi", ' +
  '"notes": "konuşmacı notu 1-3 cümle (Türkçe)"}]}';

function deckSystem(slideCount: number): string {
  return (
    "Sen kıdemli bir sunum tasarımcısı ve hikâye anlatıcısısın. Kullanıcının brief'inden " +
    `${slideCount} slaytlık profesyonel bir sunum kurgula. ` +
    "SADECE geçerli JSON döndür (istersen tek bir ```json bloğu içinde) — başka açıklama yazma. Şema:\n" +
    DECK_SCHEMA + "\n" +
    "Kurallar: ilk slayt layout=cover (etkileyici başlık + subtitle), son slayt layout=end (kapanış/CTA). " +
    "Aralarda bölüm geçişi için section, içerik için bullets/two-col, güçlü tek fikir için quote, " +
    "görsel anlatım için image kullan ve düzenleri ÇEŞİTLENDİR. " +
    "İçerik Türkçe; imagePrompt alanları İngilizce ve fotoğrafik/illüstratif sahne betimi olsun " +
    "(cover ve image slaytlarına mutlaka imagePrompt ekle). " +
    "Her slayta 1-3 cümlelik Türkçe konuşmacı notu (notes) yaz. Bilgi uydurma; brief'te olmayan " +
    "sayısal iddia ekleme, genel ifade kullan."
  );
}

const SLIDE_SCHEMA =
  '{"layout": "cover|section|bullets|two-col|image|quote|end", "title": "...", "subtitle": "...", ' +
  '"bullets": ["..."], "body": "...", "imagePrompt": "İngilizce", "notes": "Türkçe"}';

export interface DeckGenOptions {
  brief: string;
  slideCount: number;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

async function streamChat(system: string, user: string, opts: { onDelta?: (t: string) => void; signal?: AbortSignal; temperature?: number }): Promise<string> {
  const resolved = await resolveKey();
  if (!resolved) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
  const cfg = useStore.getState().config;
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      messages: [{ role: "user", content: user }],
      baseUrl: resolved.baseUrl, model: resolved.model, apiKey: resolved.apiKey, provider: resolved.provider,
      systemPrompt: system,
      fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
      tools: false, webSearch: false, temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ""; let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const ln of lines) {
      const t = ln.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const j = JSON.parse(p) as { choices?: { delta?: { content?: string } }[] };
        const d = j.choices?.[0]?.delta?.content ?? "";
        if (d) { full += d; opts.onDelta?.(full); }
      } catch { /* parçalı satır */ }
    }
  }
  return full;
}

/** Brief'ten tam deste üretir. */
export async function generateDeck(opts: DeckGenOptions): Promise<SlideDeck> {
  const full = await streamChat(deckSystem(opts.slideCount), opts.brief, {
    onDelta: opts.onDelta, signal: opts.signal, temperature: 0.7,
  });
  const deck = parseDeckJson(full, opts.brief.slice(0, 48));
  deck.brief = opts.brief;
  return deck;
}

export interface SlideRewriteOptions {
  deck: SlideDeck;
  index: number;
  instruction: string;
  signal?: AbortSignal;
}

/** Tek slaytı bağlam içinde yeniden yazar (Google Slides'taki 'yeniden oluştur'
    fikrinin craft yorumu). Deste yapısı korunur, yalnız o slayt değişir. */
export async function rewriteSlide(opts: SlideRewriteOptions): Promise<Slide> {
  const { deck, index, instruction } = opts;
  const outline = deck.slides.map((s, i) => `${i + 1}. [${s.layout}] ${s.title ?? ""}`).join("\n");
  const current = deck.slides[index];
  const sys =
    "Bir sunumun TEK slaytını yeniden yazıyorsun. SADECE o slaytın JSON nesnesini döndür — dizi değil, açıklama yok. Şema:\n" +
    SLIDE_SCHEMA + "\nİçerik Türkçe, imagePrompt İngilizce. Sunumun akışına ve tonuna uy.";
  const user =
    `Sunum: ${deck.title}\nAkış:\n${outline}\n\n` +
    `Yeniden yazılacak slayt (${index + 1}):\n${JSON.stringify({ ...current, id: undefined, imageUrl: undefined })}\n\n` +
    `İstek: ${instruction || "Bu slaytı daha etkili, net ve özlü yap."}`;
  const full = await streamChat(sys, user, { signal: opts.signal, temperature: 0.7 });
  /* Tek slayt JSON'unu deste şemasına sarıp mevcut doğrulayıcıyı kullan. */
  const wrapped = parseDeckJson(`{"title":"x","slides":[${extractObject(full)}]}`);
  return wrapped.slides[0];
}

/* Yanıttan ilk dengeli { } bloğunu al (slides.extractJson zaten var ama o
   desteyi arar; burada tek nesne bekliyoruz — aynı mantık yeter). */
function extractObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  if (start === -1) throw new Error("Slayt JSON'u bulunamadı.");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("Slayt JSON'u tamamlanmamış.");
}
