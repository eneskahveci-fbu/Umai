import { describe, expect, it } from "vitest";
import { captureReferralCode, isValidReferralCode, recordReferralIfPending, referralLink } from "../referral";

/* Testler `environment: node` altında çalışır (window/localStorage yok) —
   bu yüzden yalnız saf mantık (isValidReferralCode) ve window-korumalı
   fonksiyonların no-op davranışı doğrulanır. Gerçek localStorage/Supabase
   akışı yalnız tarayıcıda çalışır (bkz. AccountSettings.tsx entegrasyonu). */

describe("isValidReferralCode", () => {
  it("geçerli bir UUID'i kabul eder", () => {
    expect(isValidReferralCode("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("büyük harfli UUID'i de kabul eder", () => {
    expect(isValidReferralCode("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("geçersiz biçimleri reddeder", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("not-a-uuid")).toBe(false);
    expect(isValidReferralCode("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(isValidReferralCode("<script>alert(1)</script>")).toBe(false);
  });
});

describe("referralLink", () => {
  it("window yokken (SSR) NEXT_PUBLIC_SITE_URL yedeğine düşer", () => {
    const link = referralLink("550e8400-e29b-41d4-a716-446655440000");
    expect(link).toMatch(/^https?:\/\/.+\/\?ref=550e8400-e29b-41d4-a716-446655440000$/);
  });
});

describe("window-korumalı fonksiyonlar (node ortamında no-op)", () => {
  it("captureReferralCode window yokken patlamaz", () => {
    expect(() => captureReferralCode()).not.toThrow();
  });

  it("recordReferralIfPending window yokken patlamaz", () => {
    expect(() => recordReferralIfPending("550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
  });
});
