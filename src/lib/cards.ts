/* Kartlar çekirdeği — Anki'den İLHAM alan (klonu değil) craft yorumu:
   brief/vurgular → AI soru-cevap kartları → Leitner kutulu aralıklı tekrar.
   Tam SM-2 DEĞİL (bilinçli): 5 kutulu Leitner basit, açıklanabilir ve yerel
   veriyle (config) yeterli. Dışa aktarma: Anki'nin içe aktardığı TSV. */
import type { CraftDeck, FlashCard, Highlight } from "./types";
import { extractJsonObject } from "./jsonExtract";
import { streamJson } from "./genJson";

export const MAX_DECK_CARDS = 60;

/* Token bütçesi — 60 karta kadar ön/arka metin (300+600 karakter tavanlı)
   sunucu varsayılanı 8192'yi kolayca aşıyor. */
const CARDS_MAX_TOKENS = 14_000;
const CARDS_FROM_HIGHLIGHTS_MAX_TOKENS = 8_000;
export const MAX_FRONT_CHARS = 300;
export const MAX_BACK_CHARS = 600;
export const MAX_HIGHLIGHTS = 300;
export const MAX_HIGHLIGHT_CHARS = 500;

/** Leitner kutusu → bir sonraki tekrar aralığı (ms): 10 dk, 1g, 3g, 7g, 21g. */
export const LEITNER_INTERVALS_MS = [
  10 * 60_000,
  24 * 3_600_000,
  3 * 24 * 3_600_000,
  7 * 24 * 3_600_000,
  21 * 24 * 3_600_000,
] as const;

export function newCardId(): string {
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newCard(front = "", back = "", now = Date.now()): FlashCard {
  return { id: newCardId(), front, back, box: 0, due: now };
}

/* ── Cloze kartlar (Anki'nin {{c1::cevap}} sözdizimi) ──────────────────── */

const CLOZE_RE = /\{\{c\d+::(.*?)\}\}/g;

/** Cloze şablonundan ön/arka yüzü türetir: önde boşluklar [...] ile gizlenir,
    arkada gerçek cevaplar açılır. Birden çok {{c1::}}/{{c2::}} aynı anda
    gizlenir/açılır — v1 kasıtlı olarak Anki'nin numaraya göre kart çoğaltma
    davranışını uygulamaz (tek kart, tüm boşluklar birlikte). */
export function renderCloze(cloze: string): { front: string; back: string } {
  return { front: cloze.replace(CLOZE_RE, "[...]"), back: cloze.replace(CLOZE_RE, "$1") };
}

export function newClozeCard(cloze = "Metnin bir kısmı {{c1::gizli}} olsun.", now = Date.now()): FlashCard {
  const { front, back } = renderCloze(cloze);
  return { id: newCardId(), front, back, box: 0, due: now, type: "cloze", cloze };
}

/* ── Aralıklı tekrar (saf) ─────────────────────────────────────────────── */

/** Cevap değerlendirmesi: doğru → kutu yükselir; yanlış → kutu 0'a döner.
    due her durumda yeni kutunun aralığı kadar ileri atılır. */
export function gradeCard(card: FlashCard, ok: boolean, now = Date.now()): FlashCard {
  const box = ok ? Math.min(card.box + 1, LEITNER_INTERVALS_MS.length - 1) : 0;
  return { ...card, box, due: now + LEITNER_INTERVALS_MS[box] };
}

/** Vadesi gelmiş kartlar, en eskisi önce. */
export function dueCards(cards: FlashCard[], now = Date.now()): FlashCard[] {
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}

/* ── LLM çıktısını güvenli desteye çevirme ─────────────────────────────── */

function normalizeCard(raw: unknown, now: number): FlashCard | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const front = typeof r.front === "string" ? r.front.trim().slice(0, MAX_FRONT_CHARS) : "";
  const back = typeof r.back === "string" ? r.back.trim().slice(0, MAX_BACK_CHARS) : "";
  if (!front || !back) return null;
  return { id: newCardId(), front, back, box: 0, due: now };
}

export function normalizeDeck(raw: unknown, fallbackTitle = "Kart destesi"): CraftDeck | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const now = Date.now();
  const cards = (Array.isArray(r.cards) ? r.cards : [])
    .map((c) => normalizeCard(c, now))
    .filter((c): c is FlashCard => c !== null)
    .slice(0, MAX_DECK_CARDS);
  if (!cards.length) return null;
  return {
    id: `deck_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: (typeof r.title === "string" && r.title.trim()) ? r.title.trim() : fallbackTitle,
    cards,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseDeckJson(text: string, fallbackTitle = "Kart destesi"): CraftDeck {
  let raw: unknown;
  try { raw = JSON.parse(extractJsonObject(text)); } catch { throw new Error("Kart JSON'u bozuk — tekrar dene."); }
  const deck = normalizeDeck(raw, fallbackTitle);
  if (!deck) throw new Error("Destede kullanılabilir kart yok — brief'i netleştir.");
  return deck;
}

/* ── Dışa aktarma — Anki'nin doğrudan içe aktardığı TSV ────────────────── */

export function deckToTsv(deck: CraftDeck): string {
  /* Sekme/yeni satır alan kaçışı: Anki TSV'de alan içi sekme bozar; boşlukla
     düzleştirilir. */
  const flat = (s: string) => s.replace(/[\t\n\r]+/g, " ").trim();
  return deck.cards.map((c) => `${flat(c.front)}\t${flat(c.back)}`).join("\n") + "\n";
}

/** deckToTsv'nin tersi: Anki'den (veya bir tablodan) dışa aktarılmış
    "ön yüz<TAB>arka yüz" satırlarından kart listesi üretir — her zaman
    basic kart üretir (cloze içe aktarma kapsam dışı). Eksik/boş satırlar
    ve fazladan sütunlar (yalnız ilk 2 alan kullanılır) yok sayılır. */
export function parseCardsTsv(text: string): FlashCard[] {
  const now = Date.now();
  return text.split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((cols) => cols.length >= 2 && cols[0].trim() && cols[1].trim())
    .map(([front, back]) => newCard(front.trim().slice(0, MAX_FRONT_CHARS), back.trim().slice(0, MAX_BACK_CHARS), now))
    .slice(0, MAX_DECK_CARDS);
}

/* ── Vurgular (saf yardımcılar — store bunları çağırır) ────────────────── */

export function newHighlight(text: string, source: string, now = Date.now()): Highlight {
  return {
    id: `hl_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim().slice(0, MAX_HIGHLIGHT_CHARS),
    source: source.trim().slice(0, 80) || "Sohbet",
    createdAt: now,
  };
}

/** En yeni önce ekler; birebir aynı metin varsa eklemez; listeyi sınırlar. */
export function pushHighlight(list: Highlight[], h: Highlight): Highlight[] {
  if (!h.text) return list;
  if (list.some((x) => x.text === h.text)) return list;
  return [h, ...list].slice(0, MAX_HIGHLIGHTS);
}

/* ── Üretim ────────────────────────────────────────────────────────────── */

const DECK_SCHEMA =
  '{"title": "deste başlığı", "cards": [{"front": "soru / kavram", "back": "kısa net cevap"}]}';

const DECK_RULES =
  `Kurallar: 8-20 kart; her kart TEK bilgiyi sorsun (atomik); ön yüz soru/kavram (≤${MAX_FRONT_CHARS} krk), ` +
  `arka yüz kısa net cevap (≤${MAX_BACK_CHARS} krk); ezber değil anlama ölçen sorular kur; bilgi uydurma. TÜRKÇE.`;

export interface DeckGenOptions {
  brief: string;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export async function generateDeck(opts: DeckGenOptions): Promise<CraftDeck> {
  const sys =
    "Sen deneyimli bir eğitmen ve bilişsel bilim meraklısısın. Kullanıcının brief'inden çalışma kartları " +
    "(flashcard) üret. SADECE geçerli JSON döndür (istersen tek ```json bloğu). Şema:\n" +
    DECK_SCHEMA + "\n" + DECK_RULES;
  const deck = await streamJson({
    system: sys, messages: [{ role: "user", content: opts.brief }],
    onDelta: opts.onDelta, signal: opts.signal, temperature: 0.5,
    maxTokens: CARDS_MAX_TOKENS,
    parse: (raw) => parseDeckJson(raw, opts.brief.slice(0, 48)),
  });
  deck.brief = opts.brief;
  return deck;
}

/** Seçili vurgulardan kart üretir (yalnız YENİ kartlar döner — desteye
    ekleme/deste kurma çağırana aittir). */
export async function cardsFromHighlights(highlights: Highlight[], signal?: AbortSignal): Promise<FlashCard[]> {
  if (!highlights.length) throw new Error("Vurgu seçilmedi.");
  const sys =
    "Aşağıdaki VURGULARDAN çalışma kartları üret — yalnız vurgulardaki bilgiyi kullan, ekleme yapma. " +
    "SADECE geçerli JSON döndür. Şema:\n" + DECK_SCHEMA + "\n" + DECK_RULES;
  const user = highlights.map((h, i) => `${i + 1}. ${h.text}`).join("\n\n").slice(0, 8000);
  const deck = await streamJson({
    system: sys, messages: [{ role: "user", content: user }], signal, temperature: 0.4,
    maxTokens: CARDS_FROM_HIGHLIGHTS_MAX_TOKENS,
    parse: (raw) => parseDeckJson(raw, "Vurgulardan"),
  });
  return deck.cards;
}
