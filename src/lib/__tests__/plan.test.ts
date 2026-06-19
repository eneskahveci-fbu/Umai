import { describe, it, expect } from "vitest";
import { isPro, resolveModelAccess } from "../plan";

describe("plan gating", () => {
  it("isPro yalnızca 'pro' için true", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("free")).toBe(false);
    expect(isPro(undefined)).toBe(false);
    expect(isPro(null)).toBe(false);
    expect(isPro("")).toBe(false);
  });
});

describe("resolveModelAccess — Pro kapısı (MUTLAK KURAL: BYOK hep çalışır)", () => {
  const base = { hasClientKey: false, providerNeedsKey: true, hasServerKey: true, isPro: false };

  it("BYOK (istemci anahtarı var) → her zaman 'client'", () => {
    expect(resolveModelAccess({ ...base, hasClientKey: true, isPro: false })).toBe("client");
    expect(resolveModelAccess({ ...base, hasClientKey: true, hasServerKey: false })).toBe("client");
  });

  it("anahtar gerektirmeyen sağlayıcı (pollinations/ollama) → 'client'", () => {
    expect(resolveModelAccess({ ...base, providerNeedsKey: false })).toBe("client");
  });

  it("anahtarsız + sunucu anahtarı + Pro → 'server'", () => {
    expect(resolveModelAccess({ ...base, isPro: true })).toBe("server");
  });

  it("anahtarsız + sunucu anahtarı + Pro DEĞİL → 'free-fallback' (ücretsiz çalışır)", () => {
    expect(resolveModelAccess({ ...base, isPro: false })).toBe("free-fallback");
  });

  it("anahtarsız + sunucu anahtarı YOK → 'none' (mevcut hata)", () => {
    expect(resolveModelAccess({ ...base, hasServerKey: false })).toBe("none");
  });
});
