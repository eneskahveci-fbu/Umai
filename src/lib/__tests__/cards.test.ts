import { describe, it, expect } from "vitest";
import {
  deckToTsv, dueCards, gradeCard, LEITNER_INTERVALS_MS, MAX_DECK_CARDS,
  MAX_HIGHLIGHTS, newCard, newClozeCard, newHighlight, normalizeDeck, parseCardsTsv,
  parseDeckJson, pushHighlight, renderCloze,
} from "../cards";
import type { Highlight } from "../types";

const NOW = 1_800_000_000_000;

describe("normalizeDeck / parseDeckJson", () => {
  it("geçerli kartları normalize eder: id/box/due atar, boşları eler", () => {
    const d = normalizeDeck({ title: "TS", cards: [
      { front: "Union tip nedir?", back: "Birden çok tipten biri." },
      { front: "", back: "cevapsız elenir" },
      { front: "sorusuz elenir", back: "" },
    ] })!;
    expect(d.cards.length).toBe(1);
    expect(d.cards[0].box).toBe(0);
    expect(d.cards[0].id).toMatch(/^fc_/);
  });

  it("kart sayısını sınırlar; kartsız girdi null", () => {
    const many = { cards: Array.from({ length: 80 }, (_, i) => ({ front: `s${i}`, back: `c${i}` })) };
    expect(normalizeDeck(many)!.cards.length).toBe(MAX_DECK_CARDS);
    expect(normalizeDeck({ cards: [] })).toBeNull();
  });

  it("parseDeckJson ```json bloğunu ayıklar", () => {
    const d = parseDeckJson('```json\n{"title":"X","cards":[{"front":"a","back":"b"}]}\n```');
    expect(d.cards[0].front).toBe("a");
  });
});

describe("gradeCard / dueCards (Leitner)", () => {
  it("doğru cevap kutuyu yükseltir, aralık büyür; 4'te doyar", () => {
    let c = newCard("s", "c", NOW);
    c = gradeCard(c, true, NOW);
    expect(c.box).toBe(1);
    expect(c.due).toBe(NOW + LEITNER_INTERVALS_MS[1]);
    for (let i = 0; i < 10; i++) c = gradeCard(c, true, NOW);
    expect(c.box).toBe(4);
    expect(c.due).toBe(NOW + LEITNER_INTERVALS_MS[4]);
  });

  it("yanlış cevap kutuyu 0'a döndürür (10 dk sonra tekrar)", () => {
    const c = gradeCard({ ...newCard("s", "c", NOW), box: 3 }, false, NOW);
    expect(c.box).toBe(0);
    expect(c.due).toBe(NOW + LEITNER_INTERVALS_MS[0]);
  });

  it("dueCards yalnız vadesi gelenleri, en eskisi önce döndürür", () => {
    const a = { ...newCard("a", "1", NOW), due: NOW - 50 };
    const b = { ...newCard("b", "2", NOW), due: NOW - 100 };
    const c = { ...newCard("c", "3", NOW), due: NOW + 1000 };
    expect(dueCards([a, b, c], NOW).map((x) => x.front)).toEqual(["b", "a"]);
  });
});

describe("deckToTsv", () => {
  it("sekme/yeni satırı düzleştirir, satır başına kart", () => {
    const d = normalizeDeck({ cards: [
      { front: "soru\tiçinde sekme", back: "cevap\nsatır kırımı" },
      { front: "ikinci", back: "kart" },
    ] })!;
    const tsv = deckToTsv(d);
    const lines = tsv.trimEnd().split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("soru içinde sekme\tcevap satır kırımı");
  });
});

describe("renderCloze / newClozeCard", () => {
  it("tek boşluğu ön yüzde gizler, arka yüzde açar", () => {
    const { front, back } = renderCloze("Fransa'nın başkenti {{c1::Paris}}'tir.");
    expect(front).toBe("Fransa'nın başkenti [...]'tir.");
    expect(back).toBe("Fransa'nın başkenti Paris'tir.");
  });

  it("birden çok boşluğu aynı anda gizler/açar (v1: kart başına tek kart, Anki'nin numara-bazlı çoğaltması yok)", () => {
    const { front, back } = renderCloze("{{c1::Ankara}} Türkiye'nin, {{c2::Paris}} Fransa'nın başkentidir.");
    expect(front).toBe("[...] Türkiye'nin, [...] Fransa'nın başkentidir.");
    expect(back).toBe("Ankara Türkiye'nin, Paris Fransa'nın başkentidir.");
  });

  it("boşluk yoksa metin değişmeden kalır", () => {
    const { front, back } = renderCloze("Düz bir cümle.");
    expect(front).toBe("Düz bir cümle.");
    expect(back).toBe("Düz bir cümle.");
  });

  it("newClozeCard type/cloze alanlarını set eder, front/back'i türetir", () => {
    const c = newClozeCard("{{c1::Su}} H2O'dur.", 1_000);
    expect(c.type).toBe("cloze");
    expect(c.cloze).toBe("{{c1::Su}} H2O'dur.");
    expect(c.front).toBe("[...] H2O'dur.");
    expect(c.back).toBe("Su H2O'dur.");
    expect(c.box).toBe(0);
    expect(c.due).toBe(1_000);
  });
});

describe("parseCardsTsv (deckToTsv'nin tersi — içe aktarma)", () => {
  it("ön yüz<TAB>arka yüz satırlarından kart üretir", () => {
    const cards = parseCardsTsv("Soru 1\tCevap 1\nSoru 2\tCevap 2\n");
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe("Soru 1");
    expect(cards[0].back).toBe("Cevap 1");
    expect(cards[0].box).toBe(0);
    expect(cards[0].type).toBeUndefined();
  });

  it("boş/eksik satırları atlar, fazladan sütunları yok sayar", () => {
    const cards = parseCardsTsv("Tam satır\tCevabı var\n\nSadece ön yüz\nA\tB\tC (fazladan)\n");
    expect(cards).toHaveLength(2);
    expect(cards[1].front).toBe("A");
    expect(cards[1].back).toBe("B");
  });

  it("kart sayısını MAX_DECK_CARDS ile sınırlar", () => {
    const tsv = Array.from({ length: MAX_DECK_CARDS + 10 }, (_, i) => `S${i}\tC${i}`).join("\n");
    expect(parseCardsTsv(tsv)).toHaveLength(MAX_DECK_CARDS);
  });

  it("deckToTsv çıktısını gidiş-dönüş olarak geri okuyabilir", () => {
    const d = normalizeDeck({ cards: [{ front: "A", back: "B" }, { front: "C", back: "D" }] })!;
    const roundtrip = parseCardsTsv(deckToTsv(d));
    expect(roundtrip.map((c) => [c.front, c.back])).toEqual([["A", "B"], ["C", "D"]]);
  });
});

describe("vurgular (newHighlight / pushHighlight)", () => {
  it("metni kırpar, en yeni önce ekler, birebir kopyayı eklemez", () => {
    const h1 = newHighlight("  önemli pasaj  ", "Sohbet A", NOW);
    expect(h1.text).toBe("önemli pasaj");
    let list: Highlight[] = pushHighlight([], h1);
    list = pushHighlight(list, newHighlight("önemli pasaj", "Sohbet B", NOW + 1));
    expect(list.length).toBe(1);
    list = pushHighlight(list, newHighlight("ikinci", "S", NOW + 2));
    expect(list[0].text).toBe("ikinci");
  });

  it("listeyi MAX_HIGHLIGHTS ile sınırlar", () => {
    let list: Highlight[] = [];
    for (let i = 0; i <= MAX_HIGHLIGHTS + 5; i++) list = pushHighlight(list, newHighlight(`v${i}`, "S", NOW + i));
    expect(list.length).toBe(MAX_HIGHLIGHTS);
  });
});
