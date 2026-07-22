import { describe, expect, it } from "vitest";
import { pickImageModel, pickImageProvider, IMAGE_PROVIDERS } from "../imageGen";
import type { Config, ModelProfile } from "../types";

const mk = (provider: ModelProfile["provider"], id: string = provider): ModelProfile => ({
  id, label: id, provider, baseUrl: "", model: "m", apiKey: "k",
});

const mkConfig = (over: Partial<Config> = {}): Config => ({ models: [], ...over } as Config);

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

describe("pickImageProvider — Ayarlar → Görsel üretimi tercihi (bkz. imageModelProvider)", () => {
  it("tercih yoksa (varsayılan) auto gibi davranır: öncelik sırasına göre seçer", async () => {
    const cfg = mkConfig({ models: [mk("hf"), mk("openai")] });
    expect((await pickImageProvider(cfg))?.provider).toBe("openai");
  });

  it("'pollinations' seçiliyse BYOK anahtarı olsa bile null döner (zorla ücretsiz)", async () => {
    const cfg = mkConfig({ models: [mk("gemini"), mk("openai")], imageModelProvider: "pollinations" });
    expect(await pickImageProvider(cfg)).toBeNull();
  });

  it("belirli bir sağlayıcı sabitlenmişse ve modeli/anahtarı varsa ONU döner (öncelik sırasını atlar)", async () => {
    const cfg = mkConfig({ models: [mk("gemini"), mk("hf")], imageModelProvider: "hf" });
    expect((await pickImageProvider(cfg))?.provider).toBe("hf");
  });

  it("sabitlenen sağlayıcının modeli artık yoksa sessizce auto (öncelik sıralı) davranışa düşer", async () => {
    const cfg = mkConfig({ models: [mk("gemini"), mk("hf")], imageModelProvider: "openai" });
    expect((await pickImageProvider(cfg))?.provider).toBe("gemini");
  });

  it("sabitlenen sağlayıcının anahtarı boşsa (model var ama key yok) auto'ya düşer", async () => {
    const noKey: ModelProfile = { id: "hf2", label: "hf2", provider: "hf", baseUrl: "", model: "m", apiKey: "" };
    const cfg = mkConfig({ models: [noKey, mk("gemini")], imageModelProvider: "hf" });
    expect((await pickImageProvider(cfg))?.provider).toBe("gemini");
  });

  it("hiç görüntü-yetenekli model yoksa (herhangi bir tercihte) null döner", async () => {
    expect(await pickImageProvider(mkConfig({ models: [mk("groq")] }))).toBeNull();
    expect(await pickImageProvider(mkConfig({ models: [mk("groq")], imageModelProvider: "gemini" }))).toBeNull();
  });

  /* "auto" — kullanıcı beklentisi: "hangi model seçiliyse görsel de onunla
     üretilsin". Öncelik sıralı liste yalnız AKTİF model görüntü-yetenekli
     DEĞİLSE devreye girer. */
  describe("'auto' önce AKTİF sohbet modelini dener (kullanıcı kararı)", () => {
    it("aktif model görüntü-yetenekliyse öncelik sırasını atlar, ONU kullanır", async () => {
      const cfg = mkConfig({ models: [mk("gemini"), mk("hf", "hf-active")], activeModelId: "hf-active" });
      /* Normal öncelikte gemini kazanırdı — ama aktif model hf, o yüzden hf seçilmeli. */
      expect((await pickImageProvider(cfg))?.provider).toBe("hf");
    });

    it("aktif model görüntü-yeteneksizse (ör. agnes) öncelik sıralı listeye düşer", async () => {
      const cfg = mkConfig({
        models: [mk("agnes", "agnes-active"), mk("hf"), mk("openai")],
        activeModelId: "agnes-active",
      });
      expect((await pickImageProvider(cfg))?.provider).toBe("openai");
    });

    it("aktif model görüntü-yetenekli ama anahtarı yoksa öncelik sıralı listeye düşer", async () => {
      const noKeyActive: ModelProfile = { id: "hf-nokey", label: "hf", provider: "hf", baseUrl: "", model: "m", apiKey: "" };
      const cfg = mkConfig({ models: [noKeyActive, mk("openai")], activeModelId: "hf-nokey" });
      expect((await pickImageProvider(cfg))?.provider).toBe("openai");
    });

    it("activeModelId yoksa/eşleşmiyorsa doğrudan öncelik sıralı listeye düşer (eski davranış)", async () => {
      const cfg = mkConfig({ models: [mk("hf"), mk("openai")], activeModelId: "olmayan-id" });
      expect((await pickImageProvider(cfg))?.provider).toBe("openai");
    });
  });
});
