import { describe, it, expect } from "vitest";
import {
  extractJson, parseDeckJson, normalizeDeck, deckToHtml, newSlide,
  slideNarration, slideThemeById, MAX_SLIDES, SLIDE_THEMES, lintDeck,
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

  it("görselli slaytlarda kırık-resim ikonu yerine CSS yer tutucuya düşen onerror fallback'i içerir", () => {
    const deck: SlideDeck = {
      id: "d2", title: "Görselli Sunum", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [
        { id: "s1", layout: "cover", title: "Kapak", imagePrompt: "a photo of a mountain" },
        { id: "s2", layout: "image", title: "Odak görsel", imagePrompt: "a photo of a city" },
        { id: "s3", layout: "two-col", title: "İki sütun", body: undefined, bullets: ["x"], imagePrompt: "a diagram" },
      ],
    };
    const html = deckToHtml(deck);
    // cover: dekoratif — hata olursa sadece gizlenir
    expect(html).toContain(`class="coverimg" src=`);
    expect(html).toContain("onerror=\"this.style.display='none'\"");
    // image: hata olursa gizlenir ve hemen yanındaki .imgph görünür olur
    expect(html).toContain("onerror=\"this.style.display='none'; this.nextElementSibling.style.display='block'\"");
    expect(html).toContain(`<div class="imgph" style="display:none"></div>`);
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

describe("lintDeck — kalite denetimi (danışma niteliğinde)", () => {
  const goodDeck: SlideDeck = {
    id: "d1", title: "İyi Sunum", themeId: "gece", createdAt: 0, updatedAt: 0,
    slides: [
      { id: "s1", layout: "cover", title: "Kapak", notes: "Bir not." },
      { id: "s2", layout: "bullets", title: "İçerik", bullets: ["kısa madde", "bir tane daha"], notes: "İkinci not." },
      { id: "s3", layout: "end", title: "Bitiş", notes: "Son not." },
    ],
  };

  it("boş desteyi uyarısız geçer", () => {
    expect(lintDeck({ ...goodDeck, slides: [] })).toEqual([]);
  });

  it("şemaya uyan iyi bir deste hiç uyarı üretmez", () => {
    expect(lintDeck(goodDeck)).toEqual([]);
  });

  it("ilk slayt cover değilse uyarır", () => {
    const deck = { ...goodDeck, slides: [{ ...goodDeck.slides[0]!, layout: "bullets" as const }, ...goodDeck.slides.slice(1)] };
    expect(lintDeck(deck)).toContain("ilk slayt kapak (cover) değil");
  });

  it("son slayt end değilse uyarır", () => {
    const deck = { ...goodDeck, slides: [...goodDeck.slides.slice(0, -1), { ...goodDeck.slides.at(-1)!, layout: "bullets" as const }] };
    expect(lintDeck(deck)).toContain("son slayt kapanış (end) değil");
  });

  it("konuşmacı notu eksik slaytları sayar", () => {
    const deck = { ...goodDeck, slides: goodDeck.slides.map((s, i) => (i === 1 ? { ...s, notes: undefined } : s)) };
    expect(lintDeck(deck)).toContain("1 slaytta konuşmacı notu eksik");
  });

  it("çok uzun maddeleri (>14 kelime) yakalar", () => {
    const longBullet = Array.from({ length: 20 }, (_, i) => `kelime${i}`).join(" ");
    const deck = { ...goodDeck, slides: goodDeck.slides.map((s, i) => (i === 1 ? { ...s, bullets: [longBullet] } : s)) };
    expect(lintDeck(deck)).toContain("bazı maddeler çok uzun — slaytta okunması zor olabilir");
  });

  it("kalabalık madde listelerini (>6) yakalar", () => {
    const deck = { ...goodDeck, slides: goodDeck.slides.map((s, i) => (i === 1 ? { ...s, bullets: Array.from({ length: 7 }, (_, j) => `madde ${j}`) } : s)) };
    expect(lintDeck(deck)).toContain("1 slaytta çok fazla madde var");
  });

  it("Lorem ipsum kalıntısını yakalar", () => {
    const deck = { ...goodDeck, slides: goodDeck.slides.map((s, i) => (i === 1 ? { ...s, body: "Lorem ipsum dolor sit amet" } : s)) };
    expect(lintDeck(deck)).toContain("Lorem ipsum kalmış — gerçek içerik bekleniyordu");
  });
});
