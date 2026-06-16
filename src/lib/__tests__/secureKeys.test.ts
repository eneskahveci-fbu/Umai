import { describe, it, expect } from "vitest";
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
