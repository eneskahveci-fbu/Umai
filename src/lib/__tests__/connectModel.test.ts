import { describe, expect, it } from "vitest";
import {
  KEYLESS_DEFAULT_IDS,
  checkKey,
  connectModel,
  normalizeKey,
  shouldOfferStrongerModel,
} from "../connectModel";
import { DEFAULT_CONFIG, FREE_KEY_OPTIONS, POLLINATIONS_DEFAULT_MODEL, PRESETS } from "../constants";
import type { Config, ModelProfile } from "../types";

const keyless: ModelProfile = {
  id: "pollinations-free",
  label: "✦ UMAI Default (Ücretsiz)",
  provider: "pollinations",
  baseUrl: "https://text.pollinations.ai/openai",
  model: "openai",
  apiKey: "",
};

const cfg = (models: ModelProfile[]): Config => ({
  ...DEFAULT_CONFIG,
  models,
  activeModelId: models[0]?.id ?? "",
});

describe("shouldOfferStrongerModel", () => {
  it("hiç model yokken teklif eder", () => {
    expect(shouldOfferStrongerModel({ models: [] })).toBe(true);
  });

  it("yalnız anahtarsız varsayılan varken teklif eder", () => {
    expect(shouldOfferStrongerModel({ models: [keyless] })).toBe(true);
  });

  /* REGRESYON: anahtarsız varsayılanın İKİ id'si var ve store misafir modunda
     POLLINATIONS_DEFAULT_MODEL'i ("craft-default-pollinations") kullanıyor.
     id eşleştiren ilk sürüm, köprüyü tam da onu görmesi gereken kullanıcıda
     hiç göstermiyordu (tarayıcıda açınca çıktı, birim testler kaçırmıştı). */
  it("store'un misafir/ilk-açılış varsayılanında da teklif eder", () => {
    expect(POLLINATIONS_DEFAULT_MODEL.id).not.toBe(keyless.id); // iki id gerçekten farklı
    expect(shouldOfferStrongerModel({ models: [POLLINATIONS_DEFAULT_MODEL] })).toBe(true);
  });

  it("bilinen tüm anahtarsız varsayılan id'leri için teklif eder", () => {
    for (const id of KEYLESS_DEFAULT_IDS) {
      expect(shouldOfferStrongerModel({ models: [{ ...keyless, id }] }), id).toBe(true);
    }
  });

  it("kullanıcı kendi modelini eklediyse ARTIK teklif etmez", () => {
    const own: ModelProfile = { ...keyless, id: "gemini-x", provider: "gemini", apiKey: "AIzaSyTest123456" };
    expect(shouldOfferStrongerModel({ models: [keyless, own] })).toBe(false);
    expect(shouldOfferStrongerModel({ models: [own] })).toBe(false);
  });
});

describe("normalizeKey", () => {
  it("boşluk ve tırnakları temizler", () => {
    expect(normalizeKey('  "AIzaSyAbc123"  ')).toBe("AIzaSyAbc123");
    expect(normalizeKey("`gsk_abc`")).toBe("gsk_abc");
  });

  it("kopyalanan .env satırındaki ANAHTAR= önekini atar", () => {
    expect(normalizeKey("GEMINI_API_KEY = AIzaSyAbc123")).toBe("AIzaSyAbc123");
  });

  it("araya kaçan görünmez boşlukları siler", () => {
    expect(normalizeKey("AIza Sy\nAbc123")).toBe("AIzaSyAbc123");
  });
});

describe("checkKey", () => {
  const gemini = FREE_KEY_OPTIONS.find((o) => o.provider === "gemini")!;

  it("doğru ön ekli anahtarı kabul eder", () => {
    expect(checkKey("AIzaSyABCDEFGH12345", gemini).ok).toBe(true);
  });

  it("boş, kısa, URL ve e-postayı reddeder", () => {
    expect(checkKey("", gemini).ok).toBe(false);
    expect(checkKey("abc", gemini).ok).toBe(false);
    expect(checkKey("https://aistudio.google.com/apikey", gemini).ok).toBe(false);
    expect(checkKey("birisi@example.com", gemini).ok).toBe(false);
  });

  it("ön ek tutmayanı reddeder ama 'yine de deneyebilirsin' der — sağlayıcılar ön ek değiştirebilir", () => {
    const r = checkKey("sk-baskaBirSaglayici123", gemini);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("yine de deneyebilirsin");
  });
});

describe("connectModel", () => {
  const groq = FREE_KEY_OPTIONS.find((o) => o.provider === "groq")!;

  it("yeni modeli ekler ve AKTİF yapar", () => {
    const next = connectModel(cfg([keyless]), groq, "  gsk_test123456789  ", 1000);
    expect(next.models).toHaveLength(2);
    const added = next.models[1];
    expect(added.provider).toBe("groq");
    expect(added.apiKey).toBe("gsk_test123456789");
    expect(added.baseUrl).toBe(PRESETS.groq.baseUrl);
    expect(next.activeModelId).toBe(added.id);
  });

  it("anahtarsız varsayılanı SİLMEZ — fallback zinciri ona geri düşebilmeli", () => {
    const next = connectModel(cfg([keyless]), groq, "gsk_test123456789", 1000);
    expect(next.models.some((m) => m.id === keyless.id)).toBe(true);
  });

  it("bağladıktan sonra köprü bir daha gösterilmez", () => {
    const next = connectModel(cfg([keyless]), groq, "gsk_test123456789", 1000);
    expect(shouldOfferStrongerModel(next)).toBe(false);
  });
});

describe("FREE_KEY_OPTIONS değişmezleri", () => {
  it("yalnız GERÇEKTEN ücretsiz katmanı olan sağlayıcılar listelenir", () => {
    /* prompt.md: ücretsiz deneyimin arkasına yeni engel (kart/ödeme) koyma.
       Ücretli bir sağlayıcıyı bu köprüye eklemek o kısıtı dolaylı çiğner. */
    const ucretsizKatmanli = new Set(["gemini", "groq", "cerebras", "nvidia", "github", "openrouter"]);
    for (const o of FREE_KEY_OPTIONS) {
      expect(ucretsizKatmanli.has(o.provider), `${o.provider} ücretsiz katmanlı değil`).toBe(true);
    }
  });

  it("her seçeneğin PRESETS'te karşılığı ve https anahtar adresi var", () => {
    for (const o of FREE_KEY_OPTIONS) {
      expect(PRESETS[o.provider], `${o.provider} PRESETS'te yok`).toBeTruthy();
      expect(o.keyUrl.startsWith("https://"), `${o.provider} keyUrl https değil`).toBe(true);
      expect(o.keyPrefix.length).toBeGreaterThan(1);
    }
  });
});
