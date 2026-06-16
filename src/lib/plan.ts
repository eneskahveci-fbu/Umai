export type Plan = "free" | "pro";

/* Plan kapısı. ÖNEMLİ: Pro yalnızca YENİ ek özellikleri açar; bu yardımcı asla
   mevcut bir özelliği free kullanıcıdan ALMAZ (BYOK/anonim her zaman çalışır). */
export function isPro(plan: Plan | string | null | undefined): boolean {
  return plan === "pro";
}

/* Pro'nun açtığı ek özellikler (UI metni / kapı anahtarları). */
export const PRO_FEATURES = {
  readyToUse: "Anahtarsız hazır kullanım (sunucu LLM)",
  unlimitedSync: "Sınırsız bulut senkron",
} as const;
