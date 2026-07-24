import { describe, it, expect } from "vitest";
import { detectModelCapabilities, JSON_MODE_PROVIDERS } from "../modelCapabilities";

describe("detectModelCapabilities — vision", () => {
  it("bilinen görüntü-yetenekli modelleri (farklı sağlayıcılar üzerinden) tanır", () => {
    expect(detectModelCapabilities("openai", "gpt-4o-mini").vision).toBe(true);
    expect(detectModelCapabilities("openai", "gpt-4.1").vision).toBe(true);
    expect(detectModelCapabilities("anthropic", "claude-sonnet-4-5-20250929").vision).toBe(true);
    expect(detectModelCapabilities("anthropic", "claude-3-5-sonnet-20241022").vision).toBe(true);
    expect(detectModelCapabilities("gemini", "gemini-2.5-pro").vision).toBe(true);
    expect(detectModelCapabilities("groq", "llama-3.2-11b-vision-preview").vision).toBe(true);
    expect(detectModelCapabilities("openrouter", "qwen/qwen2.5-vl-72b-instruct").vision).toBe(true);
    expect(detectModelCapabilities("xai", "grok-4").vision).toBe(true);
  });

  it("görüntü-yeteneksiz bilinen modelleri false döner", () => {
    expect(detectModelCapabilities("openai", "gpt-3.5-turbo").vision).toBe(false);
    expect(detectModelCapabilities("deepseek", "deepseek-chat").vision).toBe(false);
    expect(detectModelCapabilities("mistral", "mistral-large-latest").vision).toBe(false);
  });
});

describe("detectModelCapabilities — tools (araç çağırma)", () => {
  it("modern sohbet modellerinde varsayılan olarak true'dur", () => {
    expect(detectModelCapabilities("openai", "gpt-4o").tools).toBe(true);
    expect(detectModelCapabilities("groq", "llama-3.3-70b-versatile").tools).toBe(true);
  });

  it("gömme/ses/tamamlama modellerinde false'dur", () => {
    expect(detectModelCapabilities("openai", "text-embedding-3-large").tools).toBe(false);
    expect(detectModelCapabilities("openai", "whisper-1").tools).toBe(false);
    expect(detectModelCapabilities("openai", "tts-1").tools).toBe(false);
    expect(detectModelCapabilities("openai", "davinci-002").tools).toBe(false);
  });
});

describe("detectModelCapabilities — jsonMode (route.ts'in JSON_MODE_PROVIDERS'ıyla AYNI kaynak)", () => {
  it("bilinen ticari sağlayıcılarda true'dur", () => {
    for (const p of ["openai", "groq", "together", "mistral", "deepseek", "xai", "openrouter", "github", "nvidia", "cerebras"] as const) {
      expect(detectModelCapabilities(p, "herhangi-bir-model").jsonMode).toBe(true);
    }
  });

  it("anahtarsız/ücretsiz toplayıcılarda VE gemini/ollama'da false'dur (F2'nin bilinçli hariç tutması)", () => {
    for (const p of ["pollinations", "ovh", "hf", "ollama", "agnes", "custom", "anthropic", "gemini"] as const) {
      expect(detectModelCapabilities(p, "herhangi-bir-model").jsonMode).toBe(false);
    }
  });

  it("JSON_MODE_PROVIDERS seti route.ts ile birebir aynı 10 sağlayıcıyı içerir", () => {
    expect([...JSON_MODE_PROVIDERS].sort()).toEqual(
      ["cerebras", "deepseek", "github", "groq", "mistral", "nvidia", "openai", "openrouter", "together", "xai"].sort(),
    );
  });
});

describe("detectModelCapabilities — extendedThinking (Claude'a özgü)", () => {
  it("3.7+ ve 4.x Claude modellerinde true'dur", () => {
    expect(detectModelCapabilities("anthropic", "claude-3-7-sonnet-20250219").extendedThinking).toBe(true);
    expect(detectModelCapabilities("anthropic", "claude-sonnet-4-5-20250929").extendedThinking).toBe(true);
    expect(detectModelCapabilities("anthropic", "claude-opus-4-1-20250805").extendedThinking).toBe(true);
    expect(detectModelCapabilities("anthropic", "claude-haiku-4-5-20251001").extendedThinking).toBe(true);
  });

  it("3.5 ve önceki Claude modellerinde false'dur (thinking desteklemiyor)", () => {
    expect(detectModelCapabilities("anthropic", "claude-3-5-sonnet-20241022").extendedThinking).toBe(false);
    expect(detectModelCapabilities("anthropic", "claude-3-opus-20240229").extendedThinking).toBe(false);
  });

  it("anthropic DIŞINDAKİ sağlayıcılarda modelin adı uysa bile false'dur (yalnız Claude'a özgü mekanizma)", () => {
    expect(detectModelCapabilities("openrouter", "anthropic/claude-sonnet-4-5").extendedThinking).toBe(false);
  });
});

describe("detectModelCapabilities — nativeReasoningEffort (doğrudan OpenAI o-serisi/gpt-5)", () => {
  it("doğrudan openai sağlayıcısında o-serisi/gpt-5 ailesinde true'dur", () => {
    expect(detectModelCapabilities("openai", "o3-mini").nativeReasoningEffort).toBe(true);
    expect(detectModelCapabilities("openai", "o1").nativeReasoningEffort).toBe(true);
    expect(detectModelCapabilities("openai", "gpt-5").nativeReasoningEffort).toBe(true);
    expect(detectModelCapabilities("openai", "gpt-5-mini").nativeReasoningEffort).toBe(true);
  });

  it("doğrudan openai'de non-reasoning modellerde false'dur", () => {
    expect(detectModelCapabilities("openai", "gpt-4o").nativeReasoningEffort).toBe(false);
  });

  it("openai DIŞINDAKİ sağlayıcılarda (ör. openrouter üzerinden o3) false'dur — OpenAI'a ÖZGÜ alan adı", () => {
    expect(detectModelCapabilities("openrouter", "openai/o3-mini").nativeReasoningEffort).toBe(false);
  });
});
