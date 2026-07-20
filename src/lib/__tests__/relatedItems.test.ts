import { describe, expect, it, vi } from "vitest";
import {
  chatEmbeddingText, docEmbeddingText, formEmbeddingText, notebookEmbeddingText,
  findRelated, withFreshEmbeddings,
} from "../relatedItems";

vi.mock("../rag", async () => {
  const actual = await vi.importActual<typeof import("../rag")>("../rag");
  return {
    ...actual,
    embed: vi.fn(async (texts: string[]) => texts.map((t) => [t.length, 0])),
  };
});

describe("chatEmbeddingText", () => {
  it("başlığı ve son mesajları birleştirir", () => {
    const text = chatEmbeddingText({
      title: "Başlık",
      messages: [{ content: "merhaba" }, { content: 42 }, { content: "nasılsın" }],
    });
    expect(text).toContain("Başlık");
    expect(text).toContain("merhaba");
    expect(text).toContain("nasılsın");
  });
});

describe("docEmbeddingText", () => {
  it("başlığı ve blok metinlerini birleştirir", () => {
    const text = docEmbeddingText({ title: "Doküman", blocks: [{ text: "birinci" }, { text: "" }, { text: "ikinci" }] });
    expect(text).toBe("Doküman\nbirinci\nikinci");
  });
});

describe("formEmbeddingText", () => {
  it("başlık, açıklama ve soru metinlerini birleştirir", () => {
    const text = formEmbeddingText({
      title: "Anket", desc: "kısa açıklama",
      questions: [{ label: "isim?" }, { label: "" }, { label: "yaş?" }],
    });
    expect(text).toContain("Anket");
    expect(text).toContain("kısa açıklama");
    expect(text).toContain("isim?");
    expect(text).toContain("yaş?");
  });

  it("açıklama yoksa boş bırakır (çökmez)", () => {
    const text = formEmbeddingText({ title: "Anket", questions: [{ label: "isim?" }] });
    expect(text).toBe("Anket\n\nisim?");
  });
});

describe("notebookEmbeddingText", () => {
  it("başlık ve kaynak adı+metnini birleştirir", () => {
    const text = notebookEmbeddingText({
      title: "Defter",
      sources: [{ name: "kaynak1", text: "içerik1" }, { name: "kaynak2", text: "içerik2" }],
    });
    expect(text).toContain("Defter");
    expect(text).toContain("kaynak1");
    expect(text).toContain("içerik1");
    expect(text).toContain("kaynak2");
  });
});

describe("findRelated", () => {
  it("kendisini hariç tutar ve azalan skorla sıralar", () => {
    const a = { id: "a", embedding: [1, 0] };
    const b = { id: "b", embedding: [0.9, 0.1] };
    const c = { id: "c", embedding: [0, 1] };
    const hits = findRelated("a", a.embedding, [a, b, c], 5);
    expect(hits.map((h) => h.item.id)).toEqual(["b", "c"]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("gömmesi olmayan adayları atlar", () => {
    const a = { id: "a", embedding: [1, 0] };
    const b = { id: "b" };
    const hits = findRelated("a", a.embedding, [a, b], 5);
    expect(hits).toHaveLength(0);
  });
});

interface TestItem {
  id: string;
  text: string;
  embedding?: number[];
  embeddingVersion?: number;
}

describe("withFreshEmbeddings", () => {
  it("eksik gömmeleri hesaplar ve içerikten türetilmiş version damgası ekler", async () => {
    const items: TestItem[] = [{ id: "a", text: "hello" }];
    const next = await withFreshEmbeddings(items, (i) => i.text);
    expect(next[0].embedding).toBeDefined();
    expect(next[0].embeddingVersion).toBeDefined();
  });

  it("güncel öğelere dokunmaz (aynı referans) — metin aynıysa version de aynı", async () => {
    const first = await withFreshEmbeddings([{ id: "a", text: "hello" } as TestItem], (i) => i.text);
    const next = await withFreshEmbeddings(first, (i) => i.text);
    expect(next[0]).toBe(first[0]);
  });

  it("METİN değiştiyse (SAYI aynı kalsa bile) yeniden hesaplar — bayatlık düzeltmesi", async () => {
    /* ÖNCEKİ hatalı davranış: version harici bir "sayaç" (ör. mesaj sayısı)
       ile belirleniyordu — bir mesajı YERİNDE düzenlemek (sayıyı değiştirmeden)
       embedding'i sonsuza dek bayat bırakıyordu. Artık version doğrudan
       metnin kendisinden türediği için HERHANGİ bir metin değişikliği
       yakalanır. */
    const items: TestItem[] = [{ id: "a", text: "eski metin", embedding: [1, 0], embeddingVersion: 999 }];
    const next = await withFreshEmbeddings(items, () => "YENİ metin — aynı 'sayı' ama farklı içerik");
    expect(next[0]).not.toBe(items[0]);
    expect(next[0].embeddingVersion).not.toBe(999);
  });

  it("hiçbir şey bayat değilse aynı diziyi döndürür", async () => {
    const first = await withFreshEmbeddings([{ id: "a", text: "x" } as TestItem], (i) => i.text);
    const next = await withFreshEmbeddings(first, (i) => i.text);
    expect(next).toBe(first);
  });
});
