import { describe, expect, it } from "vitest";
import { pickImageModel, IMAGE_PROVIDERS } from "../imageGen";
import type { ModelProfile } from "../types";

const mk = (provider: ModelProfile["provider"], id = provider): ModelProfile => ({
  id, label: id, provider, baseUrl: "", model: "m", apiKey: "k",
});

describe("pickImageModel — sağlayıcı önceliği", () => {
  it("görüntü-yetenekli sağlayıcı yoksa null", () => {
    expect(pickImageModel([mk("groq"), mk("mistral")])).toBe(null);
    expect(pickImageModel([])).toBe(null);
  });
  it("öncelik sırasına uyar: gemini > openai > xai > hf", () => {
    expect(pickImageModel([mk("hf"), mk("openai"), mk("gemini")])?.provider).toBe("gemini");
    expect(pickImageModel([mk("hf"), mk("xai"), mk("openai")])?.provider).toBe("openai");
    expect(pickImageModel([mk("hf"), mk("xai")])?.provider).toBe("xai");
    expect(pickImageModel([mk("hf")])?.provider).toBe("hf");
  });
  it("görüntüsüz sağlayıcılar (pollinations dahil) atlanır", () => {
    expect(pickImageModel([mk("pollinations"), mk("anthropic"), mk("hf")])?.provider).toBe("hf");
  });
  it("öncelik listesi /api/image'ın desteklediği kümedir", () => {
    expect([...IMAGE_PROVIDERS]).toEqual(["gemini", "openai", "xai", "hf"]);
  });
});
