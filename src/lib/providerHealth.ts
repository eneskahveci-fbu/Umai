/* Sağlayıcı sağlık takibi — bir aday (provider+baseUrl) çok kısa süre önce hata
   verdiyse, aynı sıcak sunucu örneğinde (process ömrü boyunca; rate-limit.ts'teki
   aynı in-memory Map deseni) hemen tekrar denemek yerine atlanır.

   Bu YALNIZ bir hız optimizasyonudur, hiçbir adayı KALICI olarak devre dışı
   bırakmaz: soğuma süresi dolunca otomatik tekrar denenir, süreç yeniden
   başlarsa (soğuk başlangıç) sıfırlanır, ve TÜM adaylar "down" işaretliyse
   (ör. yeni başlayan bir process'te hiç veri yok, ya da gerçekten hepsi kısa
   sürede hata verdi) çağıran taraf yine de TAM aday listesine düşer — hiçbir
   koşulda "denenecek aday kalmadı" durumuna yol açmaz. Amaç: bir isteğin
   içinde saniyelerce sürebilecek bir zaman aşımını beklemeden, halihazırda
   ölü olduğu BİLİNEN bir sağlayıcıyı atlayıp doğrudan bir sonraki adaya
   geçerek toplam fallback gecikmesini azaltmak. */

interface HealthEntry { downUntil: number; failCount: number }
const health = new Map<string, HealthEntry>();

const BASE_COOLDOWN_MS = 15_000;    // ilk hatada 15sn atla
const MAX_COOLDOWN_MS = 5 * 60_000; // üst üste hatada azami 5dk

function key(provider: string, baseUrl: string): string {
  return `${provider}|${baseUrl.toLowerCase()}`;
}

/** true → bu aday az önce hata verdi, soğuma süresi henüz bitmedi. */
export function isProviderDown(provider: string, baseUrl: string): boolean {
  const e = health.get(key(provider, baseUrl));
  return !!e && e.downUntil > Date.now();
}

/** Bir aday hata verdi → soğuma süresini işaretle (üst üste hatada üstel artar). */
export function markProviderDown(provider: string, baseUrl: string): void {
  const k = key(provider, baseUrl);
  const prev = health.get(k);
  const failCount = (prev?.failCount ?? 0) + 1;
  const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (failCount - 1), MAX_COOLDOWN_MS);
  health.set(k, { downUntil: Date.now() + cooldown, failCount });
}

/** Bir aday başarılı oldu → soğuma kaydını temizle (hemen "sağlıklı" sayılsın). */
export function markProviderUp(provider: string, baseUrl: string): void {
  health.delete(key(provider, baseUrl));
}

/** Adayları sağlık durumuna göre önceliklendirir: bilinen sağlıklı olanlar önce
 *  denenir. Hepsi "down" işaretliyse (ör. hepsi gerçekten kısa sürede hata
 *  verdi) orijinal TAM listeye düşülür — bir aday asla kalıcı olarak elenmez. */
export function prioritizeHealthyCandidates<C extends { provider: string; baseUrl: string }>(
  candidates: C[],
): C[] {
  const healthy = candidates.filter((c) => !isProviderDown(c.provider, c.baseUrl));
  return healthy.length > 0 ? healthy : candidates;
}

/* Yalnız testler için: durumu sıfırla. */
export function __resetProviderHealthForTests(): void {
  health.clear();
}
