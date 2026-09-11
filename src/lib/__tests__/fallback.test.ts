import { describe, expect, it, vi } from "vitest";
import { buildFallbackChain, buildQualityFallbackChain, buildChainFor, KEYLESS_PROVIDERS } from "../fallback";
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

  it("varsayılanda EKLİ TÜM modelleri zincire alır, sonuna anahtarsız son çareleri ekler", () => {
    /* Varsayılan sınırsız: kullanıcı kaç model eklediyse hepsi sıraya girer
       (önceden maxFallbacks=3 idi ve son çarelere ayrılan 2 yuva yüzünden
       yalnız 1 kullanıcı adayı geçiyordu). Anahtarsız son çareler yine HER
       ZAMAN en sonda — "istek asla düşmez" sözü korunur. */
    const models = [
      m({ id: "active", provider: "deepseek" }),
      m({ id: "g", provider: "gemini" }),
      m({ id: "q", provider: "groq" }),
      m({ id: "c", provider: "cerebras" }),
      m({ id: "x", provider: "xai" }),
    ];
    const chain = buildFallbackChain(models, "active");
    expect(chain.map((c) => c.provider)).toEqual([
      "gemini", "groq", "cerebras", "xai", "pollinations", "ovh",
    ]);
  });

  it("anahtarsız son çareler kullanıcı adaylarınca kesilmez (açık maxFallbacks verilse bile)", () => {
    const models = [
      m({ id: "active", provider: "deepseek" }),
      m({ id: "g", provider: "gemini" }),
      m({ id: "q", provider: "groq" }),
    ];
    const chain = buildFallbackChain(models, "active", { maxFallbacks: 3 });
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

  it("BU test bloğunun altındaki buildChainFor ile aynı sonucu vermeli (sapma koruması)", () => {
    const models = [
      m({ id: "active", provider: "deepseek", model: "deepseek-chat" }),
      m({ id: "o", provider: "openai", model: "gpt-4o" }),
    ];
    expect(buildChainFor({ models, activeModelId: "active", qualityFallbackChain: true }))
      .toEqual(buildQualityFallbackChain(models, "active"));
  });

  it("varsayılanda TÜM modelleri kalite sırasıyla alır + anahtarsız son çareler sonda", () => {
    const models = [
      m({ id: "active", provider: "deepseek", model: "deepseek-chat" }),
      m({ id: "o", provider: "openai", model: "gpt-4o" }),
      m({ id: "g", provider: "gemini", model: "gemini-2.5-pro" }),
    ];
    const chain = buildQualityFallbackChain(models, "active");
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "openai", "pollinations", "ovh"]);
  });
});

describe("buildChainFor — 'kalite öncelikli' tercihi TEK yerden okunur", () => {
  const models = [
    m({ id: "active", provider: "deepseek", model: "deepseek-chat" }),
    m({ id: "x", provider: "xai", model: "grok-4" }),
    m({ id: "g", provider: "gemini", model: "gemini-2.5-pro" }),
  ];

  it("seçenek KAPALIYKEN ücretsiz/güvenilir sağlayıcı önceliğini kullanır", () => {
    const chain = buildChainFor({ models, activeModelId: "active" }, null, { pollinationsBackstop: false });
    /* Sağlayıcı-rank: gemini(0) < xai(11) */
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "xai"]);
  });

  it("seçenek AÇIKKEN model kalitesine göre sıralar (ücretli/ücretsiz ayrımı yok)", () => {
    const chain = buildChainFor(
      { models, activeModelId: "active", qualityFallbackChain: true },
      null,
      { pollinationsBackstop: false },
    );
    /* Kalite: grok-4(7) < gemini-2.5-pro(9) — sağlayıcı-rank'in tersi. */
    expect(chain.map((c) => c.provider)).toEqual(["xai", "gemini"]);
  });

  it("açıkça verilen activeId, config.activeModelId'i ezer (Fusion taslakları böyle çağırır)", () => {
    const chain = buildChainFor(
      { models, activeModelId: "active" },
      "g",
      { pollinationsBackstop: false },
    );
    expect(chain.every((c) => c.provider !== "gemini")).toBe(true);
  });

  it("strictModel AÇIKKEN boş zincir döner — Pollinations dahil hiçbir yedek kurulmaz", () => {
    const chain = buildChainFor({ models, activeModelId: "active", strictModel: true });
    expect(chain).toEqual([]);
  });

  it("strictModel, qualityFallbackChain'den ÖNCE kontrol edilir (ikisi de açık olsa bile boş döner)", () => {
    const chain = buildChainFor({ models, activeModelId: "active", strictModel: true, qualityFallbackChain: true });
    expect(chain).toEqual([]);
  });

  it("freeOrchestrator KAPALIYKEN (varsayılan/undefined) sıra değişmez", () => {
    const off = buildChainFor({ models, activeModelId: "active" }, null, { pollinationsBackstop: false });
    const explicitOff = buildChainFor({ models, activeModelId: "active", freeOrchestrator: false }, null, { pollinationsBackstop: false });
    expect(explicitOff).toEqual(off);
  });

  it("freeOrchestrator AÇIKKEN öğrenilmiş güvenilirliğe göre yeniden sıralar", async () => {
    /* orchestrator.ts localStorage'a yazar/okur — node ortamında yok, basit bir
       in-memory stub'la simüle edilir (bkz. CLAUDE.md: vitest environment node). */
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    const { recordOutcome } = await import("../orchestrator");
    /* xai'yi tekrar tekrar başarısız, gemini'yi başarılı işaretle -> xai gemini'nin
       önüne geçmiş sıralamada geriye düşmeli (sağlayıcı-rank'te zaten gemini önde,
       burada tersini kanıtlayan bir senaryo kuruyoruz). */
    for (let i = 0; i < 5; i++) recordOutcome("xai", false);
    for (let i = 0; i < 5; i++) recordOutcome("gemini", true);
    const chain = buildChainFor({ models, activeModelId: "active", freeOrchestrator: true }, null, { pollinationsBackstop: false });
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "xai"]);
    vi.unstubAllGlobals();
  });
});
