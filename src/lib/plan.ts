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

export type ModelAccess = "client" | "server" | "free-fallback" | "none";

/* Bir LLM isteği hangi anahtarla servis edilmeli? SAF + test edilebilir karar.
   MUTLAK KURAL: BYOK ve anahtar gerektirmeyen sağlayıcılar HER ZAMAN çalışır;
   sunucunun (ücretli) anahtarı YALNIZCA Pro'ya açılır. Pro değilse ücretsiz
   Pollinations'a düşülür → ücretsiz kullanıcı yine yanıt alır (kırılma yok).

   - "client"        : istemci kendi anahtarını/sağlayıcısını verdi ya da sağlayıcı
                       anahtar istemiyor (pollinations/ollama) → olduğu gibi kullan.
   - "server"        : istemci anahtarsız + sunucu anahtarı var + kullanıcı Pro → sunucu LLM.
   - "free-fallback" : istemci anahtarsız + sunucu anahtarı var ama kullanıcı Pro değil
                       → ücretsiz Pollinations'a düş.
   - "none"          : istemci anahtarsız + sunucu anahtarı yok → mevcut "anahtar yok" hatası. */
export function resolveModelAccess(opts: {
  hasClientKey: boolean;
  providerNeedsKey: boolean;
  hasServerKey: boolean;
  isPro: boolean;
}): ModelAccess {
  if (opts.hasClientKey || !opts.providerNeedsKey) return "client";
  /* Sunucu anahtarı + Pro → ücretli sunucu LLM. Aksi her durumda (sunucu
     anahtarı yok ya da Pro değil) SERT HATA verme — ücretsiz Pollinations'a
     düş ki kullanıcı her zaman yanıt alsın (kırılma yok). */
  if (opts.hasServerKey && opts.isPro) return "server";
  return "free-fallback";
}

