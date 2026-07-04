/* Bir sağlayıcının canlı model listesinden GÜVENLİ bir yedek model seçer.
   Kök sorun: eski mantık, hiçbir eşleşme yoksa listedeki alfabetik ilk modeli
   ("list[0]") sessizce seçiyordu — bu, ücretsiz bir model bekleyen kullanıcıyı
   fark ettirmeden ücretli/alakasız bir modele geçirebiliyordu (OpenRouter'da
   yüzlerce model var). Bu fonksiyon üç sonucu birbirinden AYIRIR; "iyi bir
   eşleşme bulundu" ile "tahmin ediyoruz" asla karıştırılmaz — çağıran taraf
   bu ayrıma göre farklı davranır (bkz. SettingsModal.tsx). Saf fonksiyon. */

export type ModelPickResult =
  | { kind: "hardcoded-match"; model: string }
  | { kind: "free-tier-match"; model: string }
  | { kind: "no-safe-match"; firstAvailable: string | null };

/** Orijinal model adı ":free" ile bitiyor mu — OpenRouter'ın kendi ücretsiz-
    model kuralı. Sağlayıcı adına değil, adın kendisine bakar (başka bir
    sağlayıcı aynı kuralı benimserse otomatik çalışır). */
function wantsFreeTier(originalModel?: string): boolean {
  return !!originalModel && originalModel.trim().toLowerCase().endsWith(":free");
}

export function pickReplacementModel(
  liveList: string[],
  preferredList: string[],
  originalModel?: string,
): ModelPickResult {
  if (liveList.length === 0) return { kind: "no-safe-match", firstAvailable: null };

  const hardcoded = preferredList.find((m) => liveList.includes(m));
  if (hardcoded) return { kind: "hardcoded-match", model: hardcoded };

  const wantsFree = wantsFreeTier(originalModel);
  if (wantsFree) {
    const free = liveList.find((m) => m.trim().toLowerCase().endsWith(":free"));
    if (free) return { kind: "free-tier-match", model: free };
  }

  /* Son çare — "tahmin" aşaması: orijinal niyet ücretsizdi ama hiç ":free"
     model kalmamışsa bile, liveList[0]'a düşülür (üstteki adım zaten
     ":free" arayıp bulamadı). Sonuç türü (no-safe-match) çağırana bunun
     bir GARANTİ değil TAHMİN olduğunu açıkça bildirir. */
  return { kind: "no-safe-match", firstAvailable: liveList[0] };
}
