import { describe, it, expect } from "vitest";
import {
  extractJson, parseDeckJson, normalizeDeck, deckToHtml, newSlide,
  slideNarration, slideThemeById, MAX_SLIDES, SLIDE_THEMES,
} from "../slides";
import type { SlideDeck } from "../types";

describe("extractJson — LLM yanıtından JSON ayıklama", () => {
  it("```json çitli bloğu bulur", () => {
    const t = 'İşte sunum:\n```json\n{"title":"X","slides":[]}\n```\nBitti.';
    expect(extractJson(t)).toBe('{"title":"X","slides":[]}');
  });

  it("düz metin içindeki ilk dengeli { } bloğunu bulur", () => {
    const t = 'Açıklama... {"a":{"b":1},"c":"d"} kalanı';
    expect(extractJson(t)).toBe('{"a":{"b":1},"c":"d"}');
  });

  it("string içindeki süslü parantezlere aldanmaz", () => {
    const t = '{"title":"kapanış } parantezli","slides":[]}';
    expect(extractJson(t)).toBe(t);
  });

  it("JSON yoksa null döner", () => {
    expect(extractJson("hiç json yok")).toBeNull();
  });
});

describe("parseDeckJson / normalizeDeck", () => {
  const valid = JSON.stringify({
    title: "Deneme",
    slides: [
      { layout: "cover", title: "Kapak", subtitle: "Alt", notes: "Not" },
      { layout: "bullets", title: "İçerik", bullets: ["a", "b", "  ", "c"] },
      { layout: "olmayan-düzen", title: "Düzen düşer" },
      { hicbir: "alan yok" },
    ],
  });

  it("geçerli desteyi kurar, boş maddeyi ve içeriksiz slaytı eler", () => {
    const deck = parseDeckJson(valid);
    expect(deck.title).toBe("Deneme");
    expect(deck.slides).toHaveLength(3);
    expect(deck.slides[1].bullets).toEqual(["a", "b", "c"]);
  });

  it("bilinmeyen layout 'bullets'a düşer", () => {
    const deck = parseDeckJson(valid);
    expect(deck.slides[2].layout).toBe("bullets");
  });

  it(`slayt sayısını ${MAX_SLIDES} ile sınırlar`, () => {
    const many = { title: "Çok", slides: Array.from({ length: 40 }, (_, i) => ({ layout: "bullets", title: `S${i}` })) };
    const deck = normalizeDeck(many);
    expect(deck?.slides).toHaveLength(MAX_SLIDES);
  });

  it("bozuk JSON'da anlaşılır hata fırlatır", () => {
    expect(() => parseDeckJson("{{{ bozuk")).toThrow();
    expect(() => parseDeckJson("json yok")).toThrow();
  });

  it("her slayta benzersiz id atar", () => {
    const deck = parseDeckJson(valid);
    const ids = new Set(deck.slides.map((s) => s.id));
    expect(ids.size).toBe(deck.slides.length);
  });
});

function sampleDeck(): SlideDeck {
  return {
    id: "d1", title: "Test <Sunum>", themeId: "gece",
    slides: [
      { id: "s1", layout: "cover", title: "Başlık <script>alert(1)</script>", notes: "gizli not" },
      { id: "s2", layout: "bullets", title: "Maddeler", bullets: ["bir & iki"] },
    ],
    createdAt: 0, updatedAt: 0,
  };
}

describe("deckToHtml — bağımsız dışa aktarma", () => {
  it("her slayt için bir <section> üretir", () => {
    const html = deckToHtml(sampleDeck());
    expect(html.match(/<section class="slide"/g)).toHaveLength(2);
  });

  it("kullanıcı içeriğindeki HTML'i kaçırır (XSS koruması)", () => {
    const html = deckToHtml(sampleDeck());
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("bir &amp; iki");
  });

  it("tema renklerini ve gezinme scriptini içerir", () => {
    const theme = slideThemeById("gece");
    const html = deckToHtml(sampleDeck());
    expect(html).toContain(theme.accent);
    expect(html).toContain("ArrowRight");
    expect(html).toContain("@media print");
  });
});

describe("yardımcılar", () => {
  it("slideNarration: notlar öncelikli, yoksa başlık+maddeler", () => {
    expect(slideNarration({ id: "x", layout: "cover", title: "T", notes: "Not var" })).toBe("Not var");
    expect(slideNarration({ id: "y", layout: "bullets", title: "T", bullets: ["a", "b"] })).toBe("T. a. b");
  });

  it("newSlide: id ve varsayılan içerik üretir", () => {
    const s = newSlide("bullets");
    expect(s.id).toBeTruthy();
    expect(s.bullets?.length).toBeGreaterThan(0);
  });

  it("slideThemeById: bilinmeyen id ilk temaya düşer", () => {
    expect(slideThemeById("yok-böyle-tema").id).toBe(SLIDE_THEMES[0].id);
  });
});
