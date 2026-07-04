/* Sunum üretim motoru — brief → yapılandırılmış slayt JSON'u → SlideDeck.
   Ortak akış çekirdeği genChat.ts'tedir (docs/forms/defter ile paylaşılır);
   çıktı serbest HTML değil ŞEMALI JSON'dur: slides.ts doğrular ve render eder.
   Anahtarsız kullanıcıda zincir ücretsiz Pollinations'a düşer → hep çalışır. */
import { streamChat, extractJsonObject } from "./genChat";
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

/** Brief'ten tam deste üretir. */
export async function generateDeck(opts: DeckGenOptions): Promise<SlideDeck> {
  const full = await streamChat({
    system: deckSystem(opts.slideCount),
    messages: [{ role: "user", content: opts.brief }],
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
  const full = await streamChat({ system: sys, messages: [{ role: "user", content: user }], signal: opts.signal, temperature: 0.7 });
  /* Tek slayt JSON'unu deste şemasına sarıp mevcut doğrulayıcıyı kullan. */
  const wrapped = parseDeckJson(`{"title":"x","slides":[${extractJsonObject(full)}]}`);
  return wrapped.slides[0];
}
