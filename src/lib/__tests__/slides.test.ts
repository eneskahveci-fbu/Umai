import { describe, it, expect } from "vitest";
import {
  extractJson, parseDeckJson, normalizeDeck, deckToHtml, newSlide,
  slideNarration, slideThemeById, MAX_SLIDES, SLIDE_THEMES, lintDeck, slideDensity,
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

  it("son slaytta page-break-after uygulanmaz (PDF'in sonunda fazladan boş sayfa kalmasın)", () => {
    const html = deckToHtml(sampleDeck());
    expect(html).toContain(".slide:not(:last-child) { page-break-after: always; }");
    // Genel .slide kuralı page-break-after İÇERMESİN (yalnız :not(:last-child) versiyonunda olsun).
    const printBlock = html.slice(html.indexOf("@media print"), html.indexOf("</style>"));
    const bareSlideRule = printBlock.match(/\.slide \{[^}]*\}/);
    expect(bareSlideRule?.[0]).not.toContain("page-break-after");
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
    // cover: dekoratif fon — hata olursa .coverph gradyanına düşer
    // (eskiden sessizce gizleniyordu; bkz. "kırık görsel yedeği" bloğu)
    expect(html).toContain(`class="coverimg" src=`);
    expect(html).toContain(`<div class="coverph" style="display:none"></div>`);
    // image: hata olursa gizlenir ve hemen yanındaki .imgph görünür olur
    expect(html).toContain("onerror=\"this.style.display='none'; this.nextElementSibling.style.display='block'\"");
    expect(html).toContain(`<div class="imgph" style="display:none"></div>`);
    // two-col: sütun görseli akış içi yer tutucuya düşer
    expect(html).toContain(`<div class="imgph inline" style="display:none"></div>`);
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

describe("G1 — her slaytta görsel garantisi (section/quote/bullets/two-col)", () => {
  function deckWithLayout(layout: SlideDeck["slides"][number]["layout"], extra: Partial<SlideDeck["slides"][number]> = {}): SlideDeck {
    return {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout, title: "Başlık", imagePrompt: "a photo of a forest", ...extra }],
    };
  }

  it("section düzeninde arka plan görseli (coverimg) render eder", () => {
    const html = deckToHtml(deckWithLayout("section"));
    expect(html).toContain(`class="coverimg" src=`);
  });

  it("quote düzeninde arka plan görseli render eder", () => {
    const html = deckToHtml(deckWithLayout("quote", { body: "güçlü bir söz" }));
    expect(html).toContain(`class="coverimg" src=`);
  });

  it("bullets düzeninde görsel varsa iki-sütun (cols) düzenine geçer", () => {
    const html = deckToHtml(deckWithLayout("bullets", { bullets: ["madde"] }));
    expect(html).toContain(`class="cols"`);
    expect(html).toContain(`class="colbody"`);
  });

  it("bullets düzeninde görsel yoksa eski düz listeyi korur", () => {
    const deck = deckWithLayout("bullets", { bullets: ["madde"], imagePrompt: undefined });
    const html = deckToHtml(deck);
    expect(html).not.toContain(`class="cols"`);
  });

  it("two-col düzeninde hem gövde metni hem görsel birlikte render edilir", () => {
    const html = deckToHtml(deckWithLayout("two-col", { bullets: ["madde"], body: "gövde metni" }));
    expect(html).toContain("gövde metni");
    expect(html).toContain(`class="colbody"><img`);
  });
});

describe("G2 — daha zengin/çeşitli temalar", () => {
  it("en az 4 yeni gradyanlı tema içerir", () => {
    const gradientThemes = SLIDE_THEMES.filter((t) => t.bgGradient);
    expect(gradientThemes.length).toBeGreaterThanOrEqual(4);
  });

  it("eski (gradyansız) temalar geriye dönük uyumlu kalır — düz --bg kullanılır", () => {
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "cover", title: "Kapak" }],
    };
    const html = deckToHtml(deck);
    // Bütün .slide kuralını harfiyen eşlemiyoruz (her CSS rötuşunda kırılıyordu);
    // testin derdi yalnız arka planın gradyansız olması.
    expect(html).toContain("padding: 6vmin 9vmin; background: var(--bg); }");
    expect(html).not.toContain("padding: 6vmin 9vmin; background: linear-gradient");
  });

  it("gradyanlı bir tema seçilince .slide arka planı gradyanı kullanır", () => {
    const gradientTheme = SLIDE_THEMES.find((t) => t.bgGradient)!;
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: gradientTheme.id, createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "cover", title: "Kapak" }],
    };
    const html = deckToHtml(deck);
    expect(html).toContain(gradientTheme.bgGradient!);
  });
});

describe("G3 — grafik/istatistik slaytı desteği", () => {
  it("normalizeDeck: stats alanını value/label çiftlerine ayrıştırır, en fazla 4 öğe", () => {
    const raw = {
      title: "İstatistik", slides: [{
        layout: "stats", title: "Rakamlar",
        stats: [
          { value: "%42", label: "Büyüme" }, { value: "3x", label: "Hız" },
          { value: "10 bin", label: "Kullanıcı" }, { value: "5", label: "Ülke" },
          { value: "fazla", label: "atılır" }, { value: "", label: "geçersiz" },
        ],
      }],
    };
    const deck = normalizeDeck(raw)!;
    expect(deck.slides[0].layout).toBe("stats");
    expect(deck.slides[0].stats).toHaveLength(4);
    expect(deck.slides[0].stats?.[0]).toEqual({ value: "%42", label: "Büyüme" });
  });

  it("yalnız stats alanı dolu olan bir slaytı da geçerli sayar (title/bullets/body olmasa da)", () => {
    const raw = { title: "T", slides: [{ layout: "stats", stats: [{ value: "1", label: "a" }] }] };
    const deck = normalizeDeck(raw);
    expect(deck?.slides).toHaveLength(1);
  });

  it("deckToHtml: stats kartlarını render eder", () => {
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "stats", title: "Rakamlar", stats: [{ value: "%99", label: "Memnuniyet" }] }],
    };
    const html = deckToHtml(deck);
    expect(html).toContain(`class="statgrid"`);
    expect(html).toContain(`class="statval">%99<`);
    expect(html).toContain(`class="statlabel">Memnuniyet<`);
  });

  it("XSS: stats değer/etiketleri kaçırılır", () => {
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "stats", stats: [{ value: "<script>1</script>", label: "x" }] }],
    };
    const html = deckToHtml(deck);
    expect(html).not.toContain("<script>1</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("G4 — madde başına ikon (emoji-prefix)", () => {
  it("maddenin başındaki emoji ayrı bir rozete (.bicon) taşınır, nokta işaretleyici kaldırılır", () => {
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "bullets", title: "Başlık", bullets: ["🚀 Hızlı büyüme"] }],
    };
    const html = deckToHtml(deck);
    expect(html).toContain(`<li class="hasicon"><span class="bicon">🚀</span>Hızlı büyüme</li>`);
  });

  it("emoji içermeyen maddeler eski düz <li> ile render edilir", () => {
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "bullets", title: "Başlık", bullets: ["Emojisiz madde"] }],
    };
    const html = deckToHtml(deck);
    expect(html).toContain("<li>Emojisiz madde</li>");
    expect(html).not.toContain('<li class="hasicon">');
  });

  it("emojili maddenin geri kalan metni yine de HTML-kaçırılır (XSS)", () => {
    const deck: SlideDeck = {
      id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0,
      slides: [{ id: "s1", layout: "bullets", title: "Başlık", bullets: ["✅ <script>alert(1)</script>"] }],
    };
    const html = deckToHtml(deck);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

/* ── Render kalite testi (Playwright ile ölçülen üç kusurun regresyon kilidi) ── */

const deckWith = (slides: SlideDeck["slides"]): SlideDeck =>
  ({ id: "d", title: "T", themeId: "gece", createdAt: 0, updatedAt: 0, slides });

describe("two-col — alt başlık ve boş sütun", () => {
  it("alt başlığı basar (eskiden hesaplanıp atılıyordu)", () => {
    const html = deckToHtml(deckWith([
      { id: "s1", layout: "two-col", title: "Başlık", subtitle: "Ithaka alt başlık", bullets: ["A"], body: "Gövde" },
    ]));
    expect(html).toContain("Ithaka alt başlık");
    expect(html).toContain('<p class="sub">Ithaka alt başlık</p>');
  });

  it("alt başlık da HTML-kaçırılır", () => {
    const html = deckToHtml(deckWith([
      { id: "s1", layout: "two-col", title: "B", subtitle: "<img src=x onerror=alert(1)>", bullets: ["A"], body: "G" },
    ]));
    // Etiket kaçırıldığı için zararsız düz metne dönüşür — canlı bir <img> doğmaz.
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("madde yoksa boş <ul> basmaz ve tek sütuna iner", () => {
    const html = deckToHtml(deckWith([
      { id: "s1", layout: "two-col", title: "Başlık", body: "Yalnız gövde" },
    ]));
    expect(html).not.toContain("<ul></ul>");
    expect(html).not.toContain('<div class="cols">');
  });

  it("hem madde hem sağ içerik varsa iki sütun korunur", () => {
    const html = deckToHtml(deckWith([
      { id: "s1", layout: "two-col", title: "Başlık", bullets: ["A", "B"], body: "Gövde" },
    ]));
    expect(html).toContain('<div class="cols">');
    expect(html).toContain("<ul><li>A</li><li>B</li></ul>");
  });
});

describe("kırık görsel yedeği — her düzende yer tutucu", () => {
  const withImage = (layout: SlideDeck["slides"][number]["layout"]) =>
    deckToHtml(deckWith([
      { id: "s1", layout, title: "T", body: "B", bullets: ["A"], imageUrl: "https://x.invalid/a.png" },
    ]));

  it("kapak/bölüm/alıntı görseli .coverph yedeğine düşer", () => {
    for (const layout of ["cover", "section", "quote", "end"] as const) {
      const html = withImage(layout);
      expect(html, layout).toContain('<div class="coverph" style="display:none"></div>');
      expect(html, layout).toContain("this.nextElementSibling.style.display='block'");
    }
  });

  it("iki-sütun ve görselli madde slaytı .imgph.inline yedeğine düşer", () => {
    for (const layout of ["two-col", "bullets"] as const) {
      const html = withImage(layout);
      expect(html, layout).toContain('<div class="imgph inline" style="display:none"></div>');
    }
  });

  it("hiçbir görsel artık sessizce yok edilmiyor (yedeksiz onerror kalmadı)", () => {
    for (const layout of ["cover", "section", "quote", "end", "two-col", "bullets", "image"] as const) {
      expect(withImage(layout), layout).not.toContain(`onerror="this.style.display='none'"`);
    }
  });
});

describe("slideDensity — içeriğe uyarlanan tipografi ölçeği", () => {
  it("kısa kapak seyrek (roomy) sayılır", () => {
    expect(slideDensity({ id: "s", layout: "cover", title: "Umai", subtitle: "Kısa" })).toBe("roomy");
  });

  it("6+ madde yoğun (dense) sayılır", () => {
    expect(slideDensity({ id: "s", layout: "bullets", title: "T", bullets: ["a", "b", "c", "d", "e", "f"] })).toBe("dense");
  });

  it("uzun metin madde sayısından bağımsız olarak yoğun sayılır", () => {
    expect(slideDensity({ id: "s", layout: "bullets", title: "T", body: "x".repeat(600) })).toBe("dense");
  });

  it("orta yoğunluk normal kalır", () => {
    expect(slideDensity({ id: "s", layout: "bullets", title: "T", bullets: ["x".repeat(80), "y".repeat(80), "z".repeat(80), "w".repeat(80)] })).toBe("normal");
  });

  it("yoğunluk HTML'e data-density olarak yazılır", () => {
    const html = deckToHtml(deckWith([
      { id: "s1", layout: "cover", title: "Umai" },
      { id: "s2", layout: "bullets", title: "T", bullets: ["a", "b", "c", "d", "e", "f"] },
    ]));
    expect(html).toContain('data-i="0" data-density="roomy"');
    expect(html).toContain('data-i="1" data-density="dense"');
  });
});

describe("yığın bağlamı — kapak görselinin gerçekten görünmesi", () => {
  it(".slide izole edilir; aksi halde z-index:-1 katmanları slaytın arka planının arkasında kalır", () => {
    const html = deckToHtml(deckWith([{ id: "s1", layout: "cover", title: "K", imageUrl: "https://x/y.png" }]));
    // Playwright ile ölçüldü: isolation olmadan .coverimg/.coverph HİÇ boyanmıyor.
    expect(html).toContain(".slide { --s: 1; isolation: isolate;");
    expect(html).toContain(".coverimg { position: absolute; inset: 0;");
  });
});
