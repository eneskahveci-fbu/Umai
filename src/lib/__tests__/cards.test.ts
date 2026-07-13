import { describe, it, expect } from "vitest";
import {
  deckToTsv, dueCards, gradeCard, LEITNER_INTERVALS_MS, MAX_DECK_CARDS,
  MAX_HIGHLIGHTS, newCard, newHighlight, normalizeDeck, parseDeckJson, pushHighlight,
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
