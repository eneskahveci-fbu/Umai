import { describe, expect, it } from "vitest";
import { prettyModelName, describeModel, buildIdentityPrompt } from "../modelIdentity";

/* R1 — kullanıcı şikayeti: "hangi modelsin diye sorduğumda Umai diyor; kendi
   adını söyleyip Umai platformunda çalıştığını söylemesi gerekiyor." */

describe("prettyModelName", () => {
  it("kurum önekini atar ve okunur ad üretir", () => {
    expect(prettyModelName("meta/llama-3.3-70b-instruct")).toBe("Llama 3.3 70B Instruct");
    expect(prettyModelName("Qwen/Qwen2.5-Coder-32B-Instruct")).toBe("Qwen2.5 Coder 32B Instruct");
  });

  it("Claude sürüm tirelerini noktaya çevirir", () => {
    expect(prettyModelName("claude-opus-4-8")).toBe("Claude Opus 4.8");
    expect(prettyModelName("claude-sonnet-4-5")).toBe("Claude Sonnet 4.5");
    expect(prettyModelName("claude-3-5-sonnet-20241022")).toBe("Claude 3.5 Sonnet");
  });

  it("OpenAI ürün adlarının yazımını korur", () => {
    expect(prettyModelName("gpt-4.1-mini")).toBe("GPT-4.1 Mini");
    expect(prettyModelName("gpt-4o")).toBe("GPT-4o");
    expect(prettyModelName("o3-mini")).toBe("o3-mini");
  });

  it("OpenRouter varyant eklerini ad sanmaz", () => {
    expect(prettyModelName("deepseek/deepseek-chat:free")).toBe("DeepSeek Chat");
  });

  it("'-latest' sabit sürüm değildir, açıkça belirtilir", () => {
    expect(prettyModelName("gemini-flash-latest")).toBe("Gemini Flash (güncel sürüm)");
    expect(prettyModelName("mistral-large-latest")).toBe("Mistral Large (güncel sürüm)");
  });

  it("boş girdide boş döner (uydurma yok)", () => {
    expect(prettyModelName("")).toBe("");
    expect(prettyModelName("   ")).toBe("");
  });
});

describe("describeModel — üretici ile taşıyıcı sağlayıcı ayrımı", () => {
  it("Llama'yı Meta üretir, NVIDIA yalnızca sunar", () => {
    const d = describeModel("nvidia", "meta/llama-3.3-70b-instruct");
    expect(d.vendor?.name).toBe("Meta");
    expect(d.route).toBe("NVIDIA NIM");
  });

  it("kurum öneki yoksa model adından üreticiyi çıkarır", () => {
    expect(describeModel("groq", "llama-3.3-70b-versatile").vendor?.name).toBe("Meta");
    expect(describeModel("openrouter", "claude-sonnet-4-5").vendor?.name).toBe("Anthropic");
    expect(describeModel("openai", "o3-mini").vendor?.name).toBe("OpenAI");
    expect(describeModel("gemini", "gemini-flash-latest").vendor?.name).toBe("Google");
  });

  it("tanınmayan modelde üretici uydurmaz ama adı yine de verir", () => {
    const d = describeModel("custom", "acme-turbo-9");
    expect(d.vendor).toBeUndefined();
    expect(d.name).toBe("Acme Turbo 9");
  });

  it("Pollinations kimlikleri takma addır — üretici iddia edilmez", () => {
    const d = describeModel("pollinations", "openai");
    expect(d.alias).toBe(true);
    expect(d.vendor).toBeUndefined();
  });
});

describe("buildIdentityPrompt", () => {
  it("üretici + model adı + Umai platformunu birlikte söyler", () => {
    const p = buildIdentityPrompt("anthropic", "claude-opus-4-8");
    expect(p).toContain("[MODEL KİMLİĞİ]");
    expect(p).toContain("Anthropic'in Claude Opus 4.8 modeli");
    expect(p).toContain("Umai platformunda çalışıyorsun");
  });

  it("taşıyıcı sağlayıcıyı da yazar (üreticiden farklıysa)", () => {
    const p = buildIdentityPrompt("nvidia", "meta/llama-3.3-70b-instruct");
    expect(p).toContain("Meta'nın Llama 3.3 70B Instruct modeli");
    expect(p).toContain("NVIDIA NIM");
  });

  it("eğitim verisinden hatırlanan kimliği kullanmayı açıkça yasaklar", () => {
    const p = buildIdentityPrompt("openai", "gpt-4o");
    expect(p).toMatch(/BAŞKA bir model\/sürüm adı iddia etme/);
    expect(p).toMatch(/eğitim verinden/i);
  });

  it("takma adlı ücretsiz uçta kesin model adı verdirmez (dürüstlük)", () => {
    const p = buildIdentityPrompt("pollinations", "openai");
    expect(p).toContain("takma ad");
    expect(p).toMatch(/kesin bir model adı verme/);
  });

  it("model bilinmiyorsa uydurtmaz, Ayarlar'a yönlendirir", () => {
    const p = buildIdentityPrompt("custom", "");
    expect(p).toContain("Ayarlar → Modeller");
    expect(p).toContain("UYDURMA");
  });
});
