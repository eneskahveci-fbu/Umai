import { describe, expect, it } from "vitest";
import { buildFallbackChain, KEYLESS_PROVIDERS } from "./fallback";
import type { ModelProfile } from "./types";

function m(partial: Partial<ModelProfile> & { id: string; provider: ModelProfile["provider"] }): ModelProfile {
  return {
    label: partial.id,
    baseUrl: `https://api.${partial.provider}.test/v1`,
    model: `${partial.provider}-model`,
    apiKey: KEYLESS_PROVIDERS.has(partial.provider) ? "" : "key-123",
    ...partial,
  };
}

describe("buildFallbackChain", () => {
  it("aktif modeli zincire eklemez", () => {
    const models = [m({ id: "a", provider: "gemini" }), m({ id: "b", provider: "groq" })];
    const chain = buildFallbackChain(models, "a", { pollinationsBackstop: false });
    expect(chain.every((c) => c.provider !== "gemini")).toBe(true);
    expect(chain.map((c) => c.provider)).toContain("groq");
  });

  it("ücretsiz/güvenilir sağlayıcıları öne sıralar", () => {
    const models = [
      m({ id: "active", provider: "deepseek" }),
      m({ id: "x", provider: "xai" }),
      m({ id: "g", provider: "gemini" }),
      m({ id: "q", provider: "groq" }),
    ];
    const chain = buildFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain[0].provider).toBe("gemini");
    expect(chain[1].provider).toBe("groq");
    expect(chain[2].provider).toBe("xai");
  });

  it("anahtarı olmayan (anahtar gerektiren) modelleri eler", () => {
    const models = [
      m({ id: "active", provider: "gemini" }),
      m({ id: "nokey", provider: "groq", apiKey: "" }),
      m({ id: "ok", provider: "cerebras", apiKey: "csk-x" }),
    ];
    const chain = buildFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain.map((c) => c.provider)).toEqual(["cerebras"]);
  });

  it("anahtarsız Pollinations tabanını her zaman ekler", () => {
    const models = [m({ id: "active", provider: "gemini" })];
    const chain = buildFallbackChain(models, "active");
    expect(chain.some((c) => c.provider === "pollinations" && c.apiKey === "")).toBe(true);
  });

  it("zincir uzunluğunu maxFallbacks ile sınırlar", () => {
    const models = [
      m({ id: "active", provider: "deepseek" }),
      m({ id: "g", provider: "gemini" }),
      m({ id: "q", provider: "groq" }),
      m({ id: "c", provider: "cerebras" }),
      m({ id: "o", provider: "openrouter" }),
    ];
    const chain = buildFallbackChain(models, "active", { maxFallbacks: 2 });
    expect(chain.length).toBe(2);
  });

  it("yinelenen (aynı provider+url+model) adayları teklerleştirir", () => {
    const dup = { provider: "groq" as const, baseUrl: "https://api.groq.test/v1", model: "groq-model", apiKey: "k" };
    const models = [
      m({ id: "active", provider: "gemini" }),
      m({ id: "g1", ...dup }),
      m({ id: "g2", ...dup }),
    ];
    const chain = buildFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain.filter((c) => c.provider === "groq").length).toBe(1);
  });
});
