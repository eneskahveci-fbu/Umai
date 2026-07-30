/* Sunum üretim motoru — brief → yapılandırılmış slayt JSON'u → SlideDeck.
   Ortak akış çekirdeği genChat.ts'tedir (docs/forms/defter ile paylaşılır);
   çıktı serbest HTML değil ŞEMALI JSON'dur: slides.ts doğrular ve render eder.
   Anahtarsız kullanıcıda zincir ücretsiz Pollinations'a düşer → hep çalışır. */
import { streamChat } from "./genChat";
import { extractJsonObject } from "./jsonExtract";
import { streamJson } from "./genJson";
import { parseDeckJson } from "./slides";
import { generateDrafts, judgeDrafts } from "./boost";
import { CATEGORY_CRAFT } from "./studioCraft";
import type { FallbackCandidate } from "./fallback";
import type { Slide, SlideDeck } from "./types";

const DECK_SCHEMA =
  '{"title": "sunum başlığı", "slides": [{"layout": "cover|section|bullets|two-col|image|quote|stats|end", ' +
  '"title": "≤8 kelime", "subtitle": "opsiyonel kısa alt başlık", "bullets": ["en fazla 5 madde, her biri ≤12 kelime, başında ilgili TEK bir emoji"], ' +
  '"body": "opsiyonel kısa paragraf", "stats": "[{value,label} — en fazla 4 öğe, yalnız layout=stats iken]", ' +
  '"imagePrompt": "HER slayta ekle — İngilizce görsel sahne betimi", ' +
  '"notes": "konuşmacı notu 1-3 cümle (Türkçe)"}]}';

/* Token/karakter bütçesi — sunucu tarafı varsayılanı (8192 token) VE
   boost.ts'in taslak akışındaki genel 6000 karakter erken-durdurma sınırı,
   HER İKİSİ DE serbest metin taslakları için düşünülmüştü; şemalı, çok
   alanlı (title+subtitle+bullets+body+imagePrompt+notes) bir slayt JSON'u
   bunlara kolayca sığmıyor ve yanıt ortada kesilip JSON'un dengesi hiç
   kapanmıyor — "sunum bazen hiç üretilemiyor" şikayetinin doğrulanmış kök
   nedeni. Slayt başına cömert bir pay + sabit taban ile ölçekle, MAX tavanı
   altına sınırla (ana sohbetin "efor: max" tavanıyla aynı, 32768). */
const TOKENS_PER_SLIDE = 900;
const TOKENS_BASE = 2500;
const TOKENS_CAP = 32_000;

export function deckMaxTokens(slideCount: number): number {
  return Math.min(TOKENS_BASE + slideCount * TOKENS_PER_SLIDE, TOKENS_CAP);
}

/* Yaklaşık 3.2 karakter/token (TR+EN karışık JSON metni) — boost.ts'in
   karakter-tabanlı erken-durdurmasını AYNI bütçeye getirmek için. */
function deckMaxChars(slideCount: number): number {
  return Math.round(deckMaxTokens(slideCount) * 3.2);
}

function deckSystem(slideCount: number): string {
  return (
    "Sen kıdemli bir sunum tasarımcısı ve hikâye anlatıcısısın. Kullanıcının brief'inden " +
    `${slideCount} slaytlık profesyonel bir sunum kurgula. ` +
    "SADECE geçerli JSON döndür (istersen tek bir ```json bloğu içinde) — başka açıklama yazma. Şema:\n" +
    DECK_SCHEMA + "\n" +
    "Kurallar: ilk slayt layout=cover (etkileyici başlık + subtitle), son slayt layout=end (kapanış/CTA). " +
    "Aralarda bölüm geçişi için section, içerik için bullets/two-col, güçlü tek fikir için quote, " +
    "görsel anlatım için image, brief'te sayısal veri/karşılaştırma varsa EN AZ bir slaytta stats " +
    "(2-4 {value,label} öğesi; value kısa olsun, ör. '%42', '3x', '10 bin') kullan ve düzenleri ÇEŞİTLENDİR. " +
    "İçerik Türkçe; imagePrompt alanları İngilizce ve fotoğrafik/illüstratif sahne betimi olsun. " +
    "HER slayta (layout türü fark etmeksizin) bir imagePrompt ekle — sunum yalnız metin değil, " +
    "her slaytta görsel bir unsur içermeli. " +
    "bullets/two-col slaytlarındaki HER maddenin başına konuyla ilgili TEK bir emoji ekle " +
    "(ör. '🚀 Hızlı büyüme'), ardından madde metni gelsin. " +
    "Her slayta 1-3 cümlelik Türkçe konuşmacı notu (notes) yaz. Bilgi uydurma; brief'te olmayan " +
    "sayısal iddia ekleme, genel ifade kullan." +
    /* Aynı Gamma/Google Slides kalite ilkeleri (studioCraft.ts) — daha önce
       yalnız generateArtifact/buildStudioSystem yoluna (İçerik kategorisinin
       "deck" DIŞINDAKİ skilleri: email/social) enjekte ediliyordu; gerçek
       çok-slaytlı motor (bu dosya) bu rehberi hiç almıyordu. */
    CATEGORY_CRAFT["İçerik"]
  );
}

const SLIDE_SCHEMA =
  '{"layout": "cover|section|bullets|two-col|image|quote|stats|end", "title": "...", "subtitle": "...", ' +
  '"bullets": ["madde metinleri, başında ilgili TEK bir emoji"], "body": "...", ' +
  '"stats": "[{value,label}] — yalnız layout=stats iken", ' +
  '"imagePrompt": "İngilizce, her slayta ekle", "notes": "Türkçe"}';

export interface DeckGenOptions {
  brief: string;
  slideCount: number;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

/** Brief'ten tam deste üretir. Model geçersiz/yarım JSON döndürürse (özellikle
    zayıf/ücretsiz modellerde sık rastlanır — bkz. F1/F2 yorumları) kullanıcıya
    hemen hata göstermeden ÖNCE, daha katı bir talimatla BİR KEZ daha dener;
    "bazen hiç üretilemiyor" şikayetinin doğrudan azaltılması. */
export async function generateDeck(opts: DeckGenOptions): Promise<SlideDeck> {
  const deck = await streamJson({
    system: deckSystem(opts.slideCount),
    messages: [{ role: "user", content: opts.brief }],
    onDelta: opts.onDelta, signal: opts.signal, temperature: 0.7,
    maxTokens: deckMaxTokens(opts.slideCount),
    parse: (raw) => parseDeckJson(raw, opts.brief.slice(0, 48)),
  });
  deck.brief = opts.brief;
  return deck;
}

export interface DeckFusionOptions {
  brief: string;
  slideCount: number;
  /** Fusion taslak modelleri — DesignStudio.tsx'in HTML Fusion yolundaki AYNI
      pickDraftModels/fillSelfConsistency/resolveModelApiKey glue'suyla kurulur. */
  drafts: { baseUrl: string; model: string; provider: string; apiKey: string; temperature?: number }[];
  fallbacks?: FallbackCandidate[];
  judgeModel: { baseUrl: string; model: string; provider: string; apiKey: string };
  signal?: AbortSignal;
}

/** Fusion (çoklu-model) sunum üretimi: `opts.drafts`teki HER modelden PARALEL
    tam birer aday deste üretilir (aynı brief + şema), sonra bir hakem modeli
    en güvenilir/tutarlı olanı seçer. HTML üretim yolundan (boost.ts'in
    buildBoostInstruction'ı) BİLİNÇLİ olarak FARKLI çalışır: adaylar yeni bir
    LLM çağrısıyla "birleştirilmez" — şemalı JSON'u birden fazla modelin
    çıktısından harmanlamak (serbest metin sentezi gibi) şemayı bozma riski
    taşır. Bunun yerine en iyi aday OLDUĞU GİBİ seçilir (best-of-N) — yapılandırılmış
    çıktı için daha güvenilir bir strateji, üstelik bir LLM çağrısı daha az.
    Hiçbir taslak geçerli JSON üretmezse hata fırlatır — çağıran (DesignStudio.tsx)
    düz generateDeck()'e düşmelidir. */
export async function generateDeckFusion(opts: DeckFusionOptions): Promise<SlideDeck> {
  const userText = `${deckSystem(opts.slideCount)}\n\nBRIEF:\n${opts.brief}`;
  const rawDrafts = (await generateDrafts({
    userText, models: opts.drafts, fallbacks: opts.fallbacks, signal: opts.signal,
    maxTokens: deckMaxTokens(opts.slideCount), maxChars: deckMaxChars(opts.slideCount),
    timeoutMs: 90_000, jsonMode: true,
  })).map((d) => d.text);

  const validRaw: string[] = [];
  const validDecks: SlideDeck[] = [];
  for (const raw of rawDrafts) {
    try {
      validDecks.push(parseDeckJson(raw, opts.brief.slice(0, 48)));
      validRaw.push(raw);
    } catch { /* bu taslak geçerli JSON üretmedi — elenir */ }
  }
  if (validDecks.length === 0) throw new Error("Fusion taslaklarının hiçbiri geçerli sunum üretmedi.");
  if (validDecks.length === 1) {
    validDecks[0].brief = opts.brief;
    return validDecks[0];
  }

  const judge = await judgeDrafts({ userText: opts.brief, drafts: validRaw, model: opts.judgeModel, signal: opts.signal });
  const bestIdx = judge ? Math.min(Math.max(1, judge.best), validDecks.length) - 1 : 0;
  const deck = validDecks[bestIdx];
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
