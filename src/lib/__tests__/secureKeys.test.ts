import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  isEncrypted,
  decryptField,
  encryptField,
  encryptConfigSecrets,
  decryptConfigSecrets,
  hasPlaintextSecret,
  isCryptoAvailable,
} from "../secureKeys";
import { DEFAULT_CONFIG } from "../constants";
import { installFakeBrowserCrypto, removeFakeBrowserCrypto } from "./fakeBrowserCrypto";

/* MUTLAK KURAL testi: eski/düz metin veri ASLA bozulmamalı. Node ortamında
   kripto yok → katman no-op; eski davranış birebir korunmalı. */
describe("secureKeys — geriye dönük uyum", () => {
  it("test ortamında kripto yok", () => {
    expect(isCryptoAvailable()).toBe(false);
  });

  it("decryptField düz metni AYNEN döndürür (passthrough)", async () => {
    expect(await decryptField("sk-ant-plain")).toBe("sk-ant-plain");
    expect(await decryptField("")).toBe("");
  });

  it("encryptField kripto yokken değeri değiştirmez", async () => {
    expect(await encryptField("gsk_secret")).toBe("gsk_secret");
  });

  it("isEncrypted prefix'i doğru algılar", () => {
    expect(isEncrypted("enc:1:iv:ct")).toBe(true);
    expect(isEncrypted("sk-plain")).toBe(false);
    expect(isEncrypted(123)).toBe(false);
  });

  it("encrypt/decryptConfigSecrets kripto yokken Config'i AYNEN korur", async () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      models: [{ id: "1", label: "x", provider: "groq" as const, baseUrl: "u", model: "m", apiKey: "gsk_secret" }],
      providerKeys: { groq: "gsk_secret" },
      githubAccounts: [{ id: "g", username: "u", token: "ghp_tok" }],
      gitlabAccounts: [],
    };
    expect(await encryptConfigSecrets(cfg)).toEqual(cfg);
    expect(await decryptConfigSecrets(cfg)).toEqual(cfg);
  });

  it("hasPlaintextSecret düz metin anahtarını tespit eder", () => {
    expect(hasPlaintextSecret({ ...DEFAULT_CONFIG, providerKeys: { groq: "gsk_plain" } })).toBe(true);
    expect(hasPlaintextSecret({ ...DEFAULT_CONFIG, providerKeys: { groq: "enc:1:a:b" } })).toBe(false);
    expect(hasPlaintextSecret(DEFAULT_CONFIG)).toBe(false);
  });
});

describe("secureKeys — gerçek AES-GCM round-trip (sahte tarayıcı ortamı)", () => {
  beforeAll(() => installFakeBrowserCrypto());
  afterAll(() => removeFakeBrowserCrypto());

  it("kripto artık kullanılabilir sayılıyor", () => {
    expect(isCryptoAvailable()).toBe(true);
  });

  it("encryptField→decryptField gerçek anahtarı birebir geri verir (Tem 2026 off-by-one regresyonu)", async () => {
    const secret = "sk-real-secret-abcXYZ123";
    const enc = await encryptField(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toBe(secret);
    expect(enc.split(":")).toHaveLength(4); // "enc","1",iv,ct
    expect(await decryptField(enc)).toBe(secret);
  });

  it("farklı iki şifrelemenin IV'si farklıdır (aynı metin bile farklı şifreli çıktı üretir)", async () => {
    const a = await encryptField("aynı-metin");
    const b = await encryptField("aynı-metin");
    expect(a).not.toBe(b);
    expect(await decryptField(a)).toBe("aynı-metin");
    expect(await decryptField(b)).toBe("aynı-metin");
  });

  it("encryptConfigSecrets→decryptConfigSecrets gerçek anahtarları round-trip eder", async () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      models: [{ id: "1", label: "x", provider: "groq" as const, baseUrl: "u", model: "m", apiKey: "gsk_real_secret" }],
      providerKeys: { groq: "gsk_provider_secret" },
      githubAccounts: [{ id: "g", username: "u", token: "ghp_real_token" }],
      gitlabAccounts: [],
    };
    const enc = await encryptConfigSecrets(cfg);
    expect(isEncrypted(enc.models[0].apiKey)).toBe(true);
    const dec = await decryptConfigSecrets(enc);
    expect(dec.models[0].apiKey).toBe("gsk_real_secret");
    expect(dec.providerKeys?.groq).toBe("gsk_provider_secret");
    expect(dec.githubAccounts?.[0].token).toBe("ghp_real_token");
  });
});
