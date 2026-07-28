import { describe, expect, it } from "vitest";
import { buildFallbackChain, buildQualityFallbackChain, KEYLESS_PROVIDERS } from "../fallback";
import type { ModelProfile } from "../types";

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

  it("hiç model yokken iki anahtarsız halka kurulur: önce Pollinations, sonra OVH", () => {
    const chain = buildFallbackChain([], null);
    expect(chain.map((c) => c.provider)).toEqual(["pollinations", "ovh"]);
    expect(chain.every((c) => c.apiKey === "")).toBe(true);
  });

  it("anahtarsız son çareler (Pollinations + OVH) kullanıcı adaylarınca kesilmez — kendilerine yer ayrılır", () => {
    /* 2+ kullanılabilir kullanıcı adayı olsa bile maxFallbacks=3'te SON 2 yuva
       her zaman Pollinations+OVH'e ayrılır — yalnız EN YÜKSEK sıralı kullanıcı
       adayı (gemini) kalan tek yuvaya girer. Amaç: kullanıcının yapılandırdığı
       adaylar (kotası dolmuş/bozuk olabilir) güvenilir anahtarsız son çareyi
       zincirden itmesin (bkz. prompt.md kuzey yıldızı). */
    const models = [
      m({ id: "active", provider: "deepseek" }),
      m({ id: "g", provider: "gemini" }),
      m({ id: "q", provider: "groq" }),
    ];
    const chain = buildFallbackChain(models, "active");
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "pollinations", "ovh"]);
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

  it("yalnız harf büyüklüğü farklı aynı baseUrl'i de teklerleştirir (harf duyarsız dedup)", () => {
    const models = [
      m({ id: "active", provider: "gemini" }),
      m({ id: "g1", provider: "custom", baseUrl: "https://API.Example.test/v1", model: "m", apiKey: "k" }),
      m({ id: "g2", provider: "custom", baseUrl: "https://api.example.test/v1", model: "m", apiKey: "k" }),
    ];
    const chain = buildFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain.filter((c) => c.provider === "custom").length).toBe(1);
  });
});

describe("buildQualityFallbackChain", () => {
  it("aktif modeli zincire eklemez", () => {
    const models = [
      m({ id: "a", provider: "gemini", model: "gemini-2.5-pro" }),
      m({ id: "b", provider: "groq", model: "llama-3.3-70b" }),
    ];
    const chain = buildQualityFallbackChain(models, "a", { pollinationsBackstop: false });
    expect(chain.every((c) => c.provider !== "gemini")).toBe(true);
    expect(chain.map((c) => c.provider)).toContain("groq");
  });

  it("ücretli/ücretsiz ayrımı yapmadan en güçlü modelden en zayıfa sıralar", () => {
    /* Sağlayıcı-rank sıralamasında (buildFallbackChain) openai/xai en sona
       düşerdi; kalite sıralamasında yalnız bilinen model gücü sayılır. */
    const models = [
      m({ id: "active", provider: "deepseek", model: "deepseek-chat" }),
      m({ id: "x", provider: "xai", model: "grok-4" }),
      m({ id: "o", provider: "openai", model: "gpt-4o" }),
      m({ id: "g", provider: "groq", model: "llama-3.3-70b" }),
    ];
    const chain = buildQualityFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain[0].provider).toBe("xai"); // grok-4
    expect(chain[1].provider).toBe("openai"); // gpt-4o
    expect(chain[2].provider).toBe("groq"); // llama-3.3-70b
  });

  it("tanınmayan model adları listenin sonuna düşer", () => {
    const models = [
      m({ id: "active", provider: "deepseek", model: "deepseek-chat" }),
      m({ id: "u", provider: "custom", model: "acme-mystery-model", apiKey: "k" }),
      m({ id: "g", provider: "gemini", model: "gemini-2.5-pro" }),
    ];
    const chain = buildQualityFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "custom"]);
  });

  it("anahtarı olmayan modelleri eler", () => {
    const models = [
      m({ id: "active", provider: "gemini", model: "gemini-2.5-pro" }),
      m({ id: "nokey", provider: "groq", model: "llama-3.3-70b", apiKey: "" }),
      m({ id: "ok", provider: "openai", model: "gpt-4o" }),
    ];
    const chain = buildQualityFallbackChain(models, "active", { pollinationsBackstop: false });
    expect(chain.map((c) => c.provider)).toEqual(["openai"]);
  });

  it("anahtarsız son çareler (Pollinations + OVH) kendilerine her zaman yer ayırır", () => {
    const models = [
      m({ id: "active", provider: "deepseek", model: "deepseek-chat" }),
      m({ id: "o", provider: "openai", model: "gpt-4o" }),
      m({ id: "g", provider: "gemini", model: "gemini-2.5-pro" }),
    ];
    const chain = buildQualityFallbackChain(models, "active");
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "pollinations", "ovh"]);
  });
});
