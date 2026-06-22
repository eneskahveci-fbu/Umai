import { describe, expect, it } from "vitest";
import { chunkText, retrieve } from "../retrieval";

describe("chunkText", () => {
  it("paragrafları ~size parçalara böler", () => {
    const text = Array.from({ length: 20 }, (_, i) => `paragraf ${i} ` + "x".repeat(60)).join("\n\n");
    const chunks = chunkText(text, 300);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 300 * 1.8 + 1)).toBe(true);
  });
  it("kısa metni tek parça döner", () => {
    expect(chunkText("kısa metin", 700)).toEqual(["kısa metin"]);
  });
});

describe("retrieve", () => {
  const docs = [
    { name: "a.md", content: "Kimlik doğrulama Supabase ile yapılır. JWT token oturumda saklanır.\n\nÖdeme Stripe ile entegre." },
    { name: "b.md", content: "Tasarım sistemi Tailwind kullanır. Renk token'ları amber.\n\nButonlar yuvarlatılmış." },
  ];
  it("soruya en ilgili parçayı getirir", () => {
    const r = retrieve("kimlik doğrulama nasıl çalışıyor", docs, 3);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].name).toBe("a.md");
    expect(r[0].chunk.toLowerCase()).toContain("supabase");
  });
  it("eşleşme yoksa boş", () => {
    expect(retrieve("bilardo topu", docs, 3)).toEqual([]);
  });
  it("boş sorgu güvenli", () => {
    expect(retrieve("", docs, 3)).toEqual([]);
  });
});
