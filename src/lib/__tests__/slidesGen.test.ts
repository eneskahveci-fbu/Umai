import { describe, it, expect, vi } from "vitest";
import { generateDeck, rewriteSlide } from "../slidesGen";
import type { SlideDeck } from "../types";

vi.mock("../genChat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../genChat")>();
  return { ...actual, streamChat: vi.fn() };
});
import { streamChat } from "../genChat";
const mockedStreamChat = vi.mocked(streamChat);

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
