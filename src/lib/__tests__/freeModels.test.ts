import { describe, expect, it } from "vitest";
import { isFreeModel } from "@/lib/freeModels";
import { DEFAULT_CONFIG, PRESETS, POLLINATIONS_DEFAULT_MODEL } from "@/lib/constants";

describe("isFreeModel", () => {
  it("anahtarsız/ücretsiz katmanlı sağlayıcılar ücretsiz", () => {
    expect(isFreeModel("pollinations", "openai")).toBe(true);
    expect(isFreeModel("groq", "llama-3.3-70b-versatile")).toBe(true);
    expect(isFreeModel("gemini")).toBe(true);
  });
  it("OpenRouter yalnız :free sonekinde ücretsiz", () => {
    expect(isFreeModel("openrouter", "poolside/laguna-m.1:free")).toBe(true);
    expect(isFreeModel("openrouter", "anthropic/claude-sonnet-4.6")).toBe(false);
  });
  it("ücretli sağlayıcılar ücretsiz değil", () => {
    expect(isFreeModel("anthropic", "claude-opus-4-8")).toBe(false);
    expect(isFreeModel("openai", "gpt-4.1")).toBe(false);
  });
});

describe("model adlarında 'Ücretsiz' yazmaz", () => {
  it("preset ve varsayılan etiketler", () => {
    for (const p of Object.values(PRESETS)) expect(p.label).not.toMatch(/ücretsiz/i);
    expect(POLLINATIONS_DEFAULT_MODEL.label).not.toMatch(/ücretsiz|umai/i);
    for (const m of DEFAULT_CONFIG.models) expect(m.label).not.toMatch(/ücretsiz/i);
  });
});
