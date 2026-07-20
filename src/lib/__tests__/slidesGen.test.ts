import { beforeEach, describe, it, expect, vi } from "vitest";
import { generateDeck, generateDeckFusion, rewriteSlide } from "../slidesGen";
import type { SlideDeck } from "../types";

vi.mock("../genChat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../genChat")>();
  return { ...actual, streamChat: vi.fn() };
});
import { streamChat } from "../genChat";
const mockedStreamChat = vi.mocked(streamChat);

vi.mock("../boost", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../boost")>();
  return { ...actual, generateDrafts: vi.fn(), judgeDrafts: vi.fn() };
});
import { generateDrafts, judgeDrafts } from "../boost";
const mockedGenerateDrafts = vi.mocked(generateDrafts);
const mockedJudgeDrafts = vi.mocked(judgeDrafts);

describe("generateDeck", () => {
  it("streamChat yanıtını SlideDeck'e çevirir ve brief'i ekler", async () => {
    mockedStreamChat.mockResolvedValueOnce(JSON.stringify({
      title: "Test Sunumu",
      slides: [
        { layout: "cover", title: "Kapak" },
        { layout: "end", title: "Bitiş" },
      ],
    }));
    const deck = await generateDeck({ brief: "bir test brief'i", slideCount: 2 });
    expect(deck.title).toBe("Test Sunumu");
    expect(deck.slides).toHaveLength(2);
    expect(deck.brief).toBe("bir test brief'i");
  });

  it("istenen slayt sayısını sistem promptuna yazar", async () => {
    mockedStreamChat.mockResolvedValueOnce(JSON.stringify({ title: "t", slides: [{ layout: "cover", title: "Kapak" }] }));
    await generateDeck({ brief: "x", slideCount: 6 });
    const call = mockedStreamChat.mock.calls.at(-1)![0];
    expect(call.system).toContain("6 slaytlık");
  });
});

describe("generateDeckFusion", () => {
  const fakeModel = { baseUrl: "https://x", model: "m", provider: "gemini", apiKey: "k" };
  const deckJson = (title: string) => JSON.stringify({ title, slides: [{ layout: "cover", title: "Kapak" }] });
  /* generateDrafts artık DraftResult[] ({text, model}) döndürüyor (bkz.
     boost.ts — Fusion rozeti mislabeling düzeltmesi); test taslaklarını da
     bu şekle sar. */
  const dr = (text: string) => ({ text, model: "m" });

  beforeEach(() => {
    mockedGenerateDrafts.mockReset();
    mockedJudgeDrafts.mockReset();
  });

  it("hakem en iyisini seçer (best-of-N, birleştirme YOK)", async () => {
    mockedGenerateDrafts.mockResolvedValueOnce([dr(deckJson("A")), dr(deckJson("B")), dr(deckJson("C"))]);
    mockedJudgeDrafts.mockResolvedValueOnce({ best: 2, guidance: "ikinci daha iyi" });
    const deck = await generateDeckFusion({
      brief: "bir brief", slideCount: 4,
      drafts: [fakeModel, fakeModel, fakeModel],
      judgeModel: fakeModel,
    });
    expect(deck.title).toBe("B");
    expect(deck.brief).toBe("bir brief");
  });

  it("geçersiz JSON üreten taslakları eler; hakem yalnız GEÇERLİ olanlara bakar", async () => {
    mockedGenerateDrafts.mockResolvedValueOnce([dr("bozuk json değil bu"), dr(deckJson("Geçerli1")), dr(deckJson("Geçerli2"))]);
    mockedJudgeDrafts.mockResolvedValueOnce({ best: 2, guidance: "x" });
    const deck = await generateDeckFusion({
      brief: "b", slideCount: 4, drafts: [fakeModel, fakeModel, fakeModel], judgeModel: fakeModel,
    });
    expect(deck.title).toBe("Geçerli2");
    const judgeArg = mockedJudgeDrafts.mock.calls.at(-1)![0];
    expect(judgeArg.drafts).toHaveLength(2);
  });

  it("hiçbir taslak geçerli JSON üretmezse hata fırlatır", async () => {
    mockedGenerateDrafts.mockResolvedValueOnce([dr("bozuk 1"), dr("bozuk 2")]);
    await expect(
      generateDeckFusion({ brief: "b", slideCount: 4, drafts: [fakeModel, fakeModel], judgeModel: fakeModel }),
    ).rejects.toThrow();
  });

  it("yalnız 1 geçerli taslak varsa hakem HİÇ çağrılmaz, o taslak doğrudan döner", async () => {
    mockedGenerateDrafts.mockResolvedValueOnce([dr(deckJson("TekGeçerli"))]);
    const deck = await generateDeckFusion({
      brief: "b", slideCount: 4, drafts: [fakeModel], judgeModel: fakeModel,
    });
    expect(deck.title).toBe("TekGeçerli");
    expect(mockedJudgeDrafts).not.toHaveBeenCalled();
  });

  it("hakem başarısız olursa (null döner) ilk geçerli taslağa düşer", async () => {
    mockedGenerateDrafts.mockResolvedValueOnce([dr(deckJson("İlk")), dr(deckJson("İkinci"))]);
    mockedJudgeDrafts.mockResolvedValueOnce(null);
    const deck = await generateDeckFusion({
      brief: "b", slideCount: 4, drafts: [fakeModel, fakeModel], judgeModel: fakeModel,
    });
    expect(deck.title).toBe("İlk");
  });

  it("draft üretimi için deste şema+kurallarını (deckSystem) ve brief'i userText'e gömer", async () => {
    mockedGenerateDrafts.mockResolvedValueOnce([dr(deckJson("A")), dr(deckJson("B"))]);
    mockedJudgeDrafts.mockResolvedValueOnce({ best: 1, guidance: "x" });
    await generateDeckFusion({ brief: "ÖZEL-BRIEF-123", slideCount: 5, drafts: [fakeModel, fakeModel], judgeModel: fakeModel });
    const call = mockedGenerateDrafts.mock.calls.at(-1)![0];
    expect(call.userText).toContain("5 slaytlık");
    expect(call.userText).toContain("ÖZEL-BRIEF-123");
  });
});

describe("rewriteSlide", () => {
  const deck: SlideDeck = {
    id: "d1", title: "Sunum", themeId: "t1", createdAt: 0, updatedAt: 0,
    slides: [
      { id: "s1", layout: "cover", title: "Kapak" },
      { id: "s2", layout: "bullets", title: "İçerik", bullets: ["a", "b"] },
    ],
  };

  it("tek slaytı yeniden yazıp deste şemasından geçirir", async () => {
    mockedStreamChat.mockResolvedValueOnce(JSON.stringify({ layout: "bullets", title: "Yeni İçerik", bullets: ["x", "y"] }));
    const slide = await rewriteSlide({ deck, index: 1, instruction: "daha kısa yap" });
    expect(slide.title).toBe("Yeni İçerik");
    expect(slide.bullets).toEqual(["x", "y"]);
  });

  it("değiştirilen slaytın bağlamını (başlık/akış) sistem promptuna dahil eder", async () => {
    mockedStreamChat.mockResolvedValueOnce(JSON.stringify({ layout: "cover", title: "Yeni Kapak" }));
    await rewriteSlide({ deck, index: 0, instruction: "" });
    const call = mockedStreamChat.mock.calls.at(-1)![0];
    expect(call.messages[0].content).toContain(deck.title);
  });
});
