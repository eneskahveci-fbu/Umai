import { describe, it, expect } from "vitest";
import { llmProxySchema, baseUrlSchema, prReviewSchema } from "../apiSchemas";

describe("apiSchemas", () => {
  it("baseUrl yalnızca http(s) kabul eder (SSRF azaltma)", () => {
    expect(baseUrlSchema.safeParse("https://api.groq.com/openai/v1").success).toBe(true);
    expect(baseUrlSchema.safeParse("http://localhost:11434/v1").success).toBe(true);
    expect(baseUrlSchema.safeParse("file:///etc/passwd").success).toBe(false);
    expect(baseUrlSchema.safeParse("ftp://x").success).toBe(false);
  });

  it("llmProxy boş gövdeyi kabul eder (tüm alanlar opsiyonel)", () => {
    expect(llmProxySchema.safeParse({}).success).toBe(true);
  });

  it("llmProxy bilinmeyen alanları KORUR (passthrough — geriye uyum)", () => {
    const r = llmProxySchema.safeParse({ baseUrl: "https://a.b/v1", model: "m", extraField: 123 });
    expect(r.success).toBe(true);
    if (r.success) {
      const data = r.data as Record<string, unknown>;
      expect(data.extraField).toBe(123);
    }
  });

  it("prReview prNumber string'i sayıya çevirir", () => {
    const r = prReviewSchema.safeParse({ provider: "github", owner: "o", repo: "r", prNumber: "42" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prNumber).toBe(42);
  });

  it("prReview geçersiz provider'ı reddeder", () => {
    expect(prReviewSchema.safeParse({ provider: "bitbucket", owner: "o", repo: "r", prNumber: 1 }).success).toBe(false);
  });
});
