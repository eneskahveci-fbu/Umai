import { describe, expect, it } from "vitest";
import { pickImageModel, pickImageProvider, buildImageFallbackChain, IMAGE_PROVIDERS } from "../imageGen";
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
    /* NVIDIA NIM eklendi: FLUX.1-schnell'i ücretsiz nvapi anahtarıyla sunuyor
       ve HF'nin aynı modelinden farklı olarak cold-start yaşatmıyor, bu yüzden
       HF'nin ÖNÜNDE. */
    expect([...IMAGE_PROVIDERS]).toEqual(["gemini", "openai", "xai", "nvidia", "hf"]);
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

describe("buildImageFallbackChain — Ayarlar → görsel yedek zinciri", () => {
  it("görüntü-yetenekli TÜM modelleri öncelik sırasıyla döner", async () => {
    const cfg = mkConfig({ models: [mk("hf"), mk("groq"), mk("openai"), mk("gemini")] });
    const chain = await buildImageFallbackChain(cfg);
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "openai", "hf"]);
  });

  it("anahtarı olmayan modelleri eler", async () => {
    const noKey: ModelProfile = { id: "openai-nokey", label: "o", provider: "openai", baseUrl: "", model: "m", apiKey: "" };
    const cfg = mkConfig({ models: [noKey, mk("hf")] });
    const chain = await buildImageFallbackChain(cfg);
    expect(chain.map((c) => c.provider)).toEqual(["hf"]);
  });

  it("exclude verilirse o sağlayıcıyı listeden çıkarır (çağıran onu zaten ayrı denedi)", async () => {
    const cfg = mkConfig({ models: [mk("gemini"), mk("openai"), mk("hf")] });
    const chain = await buildImageFallbackChain(cfg, "gemini");
    expect(chain.map((c) => c.provider)).toEqual(["openai", "hf"]);
  });

  it("görüntü-yetenekli model yoksa boş dizi döner", async () => {
    expect(await buildImageFallbackChain(mkConfig({ models: [mk("groq")] }))).toEqual([]);
  });
});

describe("NVIDIA NIM görsel sağlayıcısı (kullanıcı isteği)", () => {
  it("bağlıysa görsel zincirine girer ve HF'nin ÖNÜNDE gelir", async () => {
    const cfg = mkConfig({ models: [mk("hf"), mk("nvidia")] });
    const chain = await buildImageFallbackChain(cfg);
    expect(chain.map((c) => c.provider)).toEqual(["nvidia", "hf"]);
  });

  it("aktif model NVIDIA ise görsel de NVIDIA ile üretilir (seçili model önce)", async () => {
    /* Kullanıcı isteği: "hangi model seçiliyse o kullanılsın". Normal öncelikte
       gemini kazanırdı; aktif model nvidia olduğu için o seçilmeli. */
    const cfg = mkConfig({
      models: [mk("gemini"), mk("nvidia", "nvidia-active")],
      activeModelId: "nvidia-active",
    });
    expect((await pickImageProvider(cfg))?.provider).toBe("nvidia");
  });

  it("aktif model görüntü üretemiyorsa bağlı en iyi görsel modeline düşer", async () => {
    /* Agnes AI gibi görüntü-yeteneksiz bir model aktifken zincir devreye girer. */
    const cfg = mkConfig({
      models: [mk("agnes", "agnes-active"), mk("nvidia")],
      activeModelId: "agnes-active",
    });
    expect((await pickImageProvider(cfg))?.provider).toBe("nvidia");
  });
});

/* Görsel MODEL kataloğu — sağlayıcı başına seçim (Ayarlar → Model → Görsel
   üretimi). Model adı NVIDIA'da URL YOLUNA girdiğinden katalog doğrulaması
   güvenlik açısından da kritik. */
describe("görsel model kataloğu", () => {
  it("her sağlayıcının en az bir modeli ve bir varsayılanı var", async () => {
    const { IMAGE_PROVIDERS, IMAGE_MODELS, defaultImageModel } = await import("../imageGen");
    for (const p of IMAGE_PROVIDERS) {
      expect(IMAGE_MODELS[p].length).toBeGreaterThan(0);
      expect(defaultImageModel(p)).toBe(IMAGE_MODELS[p][0].id);
    }
  });

  it("seçim yoksa varsayılana düşer", async () => {
    const { resolveImageModel, defaultImageModel } = await import("../imageGen");
    expect(resolveImageModel("nvidia", undefined)).toBe(defaultImageModel("nvidia"));
    expect(resolveImageModel("nvidia", {})).toBe(defaultImageModel("nvidia"));
  });

  it("kullanıcının seçtiği geçerli model korunur", async () => {
    const { resolveImageModel } = await import("../imageGen");
    expect(resolveImageModel("openai", { openai: "dall-e-3" })).toBe("dall-e-3");
  });

  /* Katalogdan kaldırılan/yeniden adlandırılan bir modelde kilitlenme olmasın. */
  it("katalogda OLMAYAN seçim sessizce varsayılana düşer", async () => {
    const { resolveImageModel, defaultImageModel } = await import("../imageGen");
    expect(resolveImageModel("nvidia", { nvidia: "silinmis/model" })).toBe(defaultImageModel("nvidia"));
  });

  /* Sunucu doğrulaması: keyfi bir değer NVIDIA'da yol enjeksiyonu olurdu. */
  it("isKnownImageModel yalnız katalogdakileri kabul eder", async () => {
    const { isKnownImageModel } = await import("../imageGen");
    expect(isKnownImageModel("nvidia", "black-forest-labs/flux.1-dev")).toBe(true);
    expect(isKnownImageModel("nvidia", "../../etc/passwd")).toBe(false);
    expect(isKnownImageModel("bilinmeyen", "her-ne-ise")).toBe(false);
  });

  /* flux.1-dev canlı testte "steps >= 5" istiyor; 25 ile ~5 sn'de dönüyor. */
  it("NVIDIA adım sayısı modele göre gelir", async () => {
    const { imageModelSteps } = await import("../imageGen");
    expect(imageModelSteps("nvidia", "black-forest-labs/flux.1-dev")).toBe(25);
    expect(imageModelSteps("nvidia", "bilinmeyen")).toBe(25);
  });

  /* Canlı doğrulandı: flux.1-schnell geçerli steps=4 ile 60 sn yanıt vermiyor;
     sdxl-turbo / stable-diffusion-xl / bria-2.3 bu uçta 404. Çalışmayan bir
     seçeneği menüye koymamak bilinçli bir karar — testle sabitleniyor. */
  it("NVIDIA kataloğunda yalnız canlı doğrulanmış model var", async () => {
    const { IMAGE_MODELS } = await import("../imageGen");
    const ids = IMAGE_MODELS.nvidia.map((m) => m.id);
    expect(ids).toEqual(["black-forest-labs/flux.1-dev"]);
  });
});

describe("addMediaAsset — Kütüphane kotası", () => {
  const asset = (id: string, url: string) => ({
    id, title: id, url, createdAt: 1, source: "image-gen" as const,
  });

  it("yeni öğeyi başa ekler", async () => {
    const { addMediaAsset } = await import("../imageGen");
    const out = addMediaAsset([asset("a", "https://x/1.png")], asset("b", "https://x/2.png"));
    expect(out.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("data-URL girdilerini 20 ile sınırlar, URL girdilerine dokunmaz", async () => {
    const { addMediaAsset, MAX_DATA_URL_ASSETS } = await import("../imageGen");
    const existing = [
      ...Array.from({ length: 30 }, (_, i) => asset(`d${i}`, "data:image/jpeg;base64,AAAA")),
      ...Array.from({ length: 30 }, (_, i) => asset(`u${i}`, `https://x/${i}.png`)),
    ];
    const out = addMediaAsset(existing, asset("yeni", "data:image/jpeg;base64,BBBB"));
    expect(out.filter((a) => a.url.startsWith("data:")).length).toBe(MAX_DATA_URL_ASSETS);
    expect(out.filter((a) => !a.url.startsWith("data:")).length).toBe(30);
  });

  it("toplam listeyi 200 ile sınırlar", async () => {
    const { addMediaAsset, MAX_MEDIA_ASSETS } = await import("../imageGen");
    const existing = Array.from({ length: 250 }, (_, i) => asset(`u${i}`, `https://x/${i}.png`));
    expect(addMediaAsset(existing, asset("yeni", "https://x/new.png")).length).toBe(MAX_MEDIA_ASSETS);
  });
});
