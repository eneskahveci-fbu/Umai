import { describe, expect, it } from "vitest";
import { chunkText, cosine } from "../rag";

describe("chunkText", () => {
  it("kısa içeriği tek parça yapar", () => {
    const chunks = chunkText("a.ts", "satir1\nsatir2");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].path).toBe("a.ts");
    expect(chunks[0].line).toBe(1);
  });

  it("uzun içeriği satır-hizalı birden çok parçaya böler", () => {
    const content = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    const chunks = chunkText("big.ts", content, 400);
    expect(chunks.length).toBeGreaterThan(1);
    /* Parça başlangıç satırları artan ve 1 tabanlı olmalı. */
    expect(chunks[0].line).toBe(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].line).toBeGreaterThan(chunks[i - 1].line);
    }
  });

  it("yalnızca boşluktan oluşan son parçayı atar", () => {
    const chunks = chunkText("x.ts", "kod\n\n   \n");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("kod");
  });
});

describe("cosine", () => {
  it("aynı yönlü vektörlerde ~1 verir", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it("dik vektörlerde 0 verir", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("farklı uzunlukta güvenli (kısa olana göre)", () => {
    expect(cosine([1, 0, 5], [1, 0])).toBeCloseTo(1);
  });
});
