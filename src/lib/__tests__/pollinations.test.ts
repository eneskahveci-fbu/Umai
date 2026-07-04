import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollinationsImageUrl, pollinationsTtsUrl, speakableText, stableSeed,
  IMAGE_MODEL_FALLBACK, TTS_MAX_CHARS,
} from "../pollinations";

describe("pollinationsImageUrl", () => {
  it("prompt'u kodlar ve temel parametreleri ekler", () => {
    const url = pollinationsImageUrl("kırmızı balon & gökyüzü", { model: "flux", width: 800, height: 600 });
    expect(url).toContain("image.pollinations.ai/prompt/");
    expect(url).toContain(encodeURIComponent("kırmızı balon & gökyüzü"));
    expect(url).toContain("width=800");
    expect(url).toContain("height=600");
    expect(url).toContain("model=flux");
    expect(url).toContain("nologo=true");
    expect(url).toContain("private=true");
    expect(url).toContain("referrer=craft-coder");
  });

  it("seed verilirse URL'e yazar (deterministik görsel)", () => {
    expect(pollinationsImageUrl("x", { seed: 42 })).toContain("seed=42");
    expect(pollinationsImageUrl("x")).not.toContain("seed=");
  });
});

describe("stableSeed", () => {
  it("aynı metin → aynı seed; aralık içinde", () => {
    expect(stableSeed("merhaba")).toBe(stableSeed("merhaba"));
    expect(stableSeed("a")).not.toBe(stableSeed("b"));
    const s = stableSeed("uzun bir prompt metni");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(1_000_000);
  });
});

describe("pollinationsTtsUrl", () => {
  it("openai-audio modeli ve sesi ekler", () => {
    const url = pollinationsTtsUrl("Merhaba dünya", "echo");
    expect(url).toContain("text.pollinations.ai/");
    expect(url).toContain("model=openai-audio");
    expect(url).toContain("voice=echo");
  });

  it(`metni ${TTS_MAX_CHARS} karakterde keser (GET URL sınırı)`, () => {
    const long = "a".repeat(TTS_MAX_CHARS * 2);
    const url = pollinationsTtsUrl(long);
    const encoded = url.split("/").pop()!.split("?")[0];
    expect(decodeURIComponent(encoded)).toHaveLength(TTS_MAX_CHARS);
  });
});

describe("speakableText — markdown'ı konuşulur metne indirger", () => {
  it("kod bloklarını, linkleri ve biçim işaretlerini temizler", () => {
    const md = "# Başlık\n\nMetin `kod` ve [link](https://x) ile.\n\n```js\nconsole.log(1)\n```\nSon.";
    const t = speakableText(md);
    expect(t).not.toContain("```");
    expect(t).not.toContain("https://x");
    expect(t).toContain("Başlık");
    expect(t).toContain("kod");
    expect(t).toContain("link");
    expect(t).toContain("(kod bloğu)");
  });
});

describe("fetchImageModels — canlı katalog + yedek", () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

  it("ağ hatasında küratörlü yedek listeye düşer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { fetchImageModels } = await import("../pollinations");
    const list = await fetchImageModels();
    expect(list).toEqual(IMAGE_MODEL_FALLBACK);
  });

  it("katalogdaki yeni modelleri küratörlü sıranın sonuna ekler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ["turbo", "flux", "yepyeni-model"],
    }));
    const { fetchImageModels: fresh } = await import("../pollinations");
    const list = await fresh();
    expect(list[0].id).toBe("flux");           // küratörlü sıra korunur
    expect(list.some((m) => m.id === "yepyeni-model")).toBe(true);
    expect(list.find((m) => m.id === "yepyeni-model")!.label).toBe("yepyeni-model");
    expect(list.some((m) => m.id === "flux-anime")).toBe(false); // katalogda yoksa listede de yok
  });

  it("boş/bozuk yanıtta yedek listeye düşer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ beklenmedik: true }) }));
    const { fetchImageModels: fresh } = await import("../pollinations");
    expect(await fresh()).toEqual(IMAGE_MODEL_FALLBACK);
  });
});
