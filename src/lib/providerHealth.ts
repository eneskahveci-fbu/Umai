/* Sağlayıcı sağlık takibi — bir aday (provider+baseUrl+MODEL) çok kısa süre önce
   hata verdiyse, aynı sıcak sunucu örneğinde (process ömrü boyunca;
   rate-limit.ts'teki aynı in-memory Map deseni) SONA alınır.

   Bu YALNIZ bir sıralama optimizasyonudur, hiçbir adayı elemez: soğuma süresi
   dolunca aday yine başa döner, süreç yeniden başlarsa (soğuk başlangıç)
   sıfırlanır. Amaç, bir isteğin içinde saniyelerce sürebilecek bir zaman
   aşımını beklemeden, halihazırda ölü olduğu BİLİNEN bir sağlayıcıyı sona
   atıp toplam fallback gecikmesini azaltmak.

   ─── Tem 2026 düzeltmesi (H6): iki ayrı hata ───────────────────────────────

   (a) Anahtar MODELİ İÇERMİYORDU (`provider|baseUrl`). Yani
   `openrouter.ai/api/v1` üzerindeki HERHANGİ bir modelde tek bir 429/5xx, o
   base URL'deki TÜM modelleri — kullanıcının o an seçtiği model dahil — 15 sn
   ilâ 5 dk boyunca "down" işaretliyordu. Farklı modeller birbirini
   sakatlıyordu. Artık anahtar modeli de içerir; soğuma yalnız gerçekten hata
   veren modele uygulanır.

   (b) `prioritizeHealthyCandidates` adayı listeden ÇIKARIYORDU (filter). İki
   sonucu vardı: kullanıcının SEÇTİĞİ model hiç denenmeden başka bir modelden
   yanıt geliyordu; ve /api/chat'teki dürüstlük kapısı `c === primary` şartına
   bağlı olduğu için HİÇ tetiklenemiyor, 400/404/410 gibi "bu model yanlış/
   kaldırılmış" hataları sessizce gizleniyordu. Dosyanın kendi "bir aday asla
   kalıcı olarak elenmez" sözü de bu pencerede yanlıştı: hepsi down değilse
   eleme gerçekten kalıcıydı. Artık ELEME YOK — yalnız yeniden sıralama, ve
   birincil aday her zaman listede kalır. */

interface HealthEntry { downUntil: number; failCount: number }
const health = new Map<string, HealthEntry>();

const BASE_COOLDOWN_MS = 15_000;    // ilk hatada sona al
const MAX_COOLDOWN_MS = 5 * 60_000; // üst üste hatada azami 5dk

function key(provider: string, baseUrl: string, model: string): string {
  return `${provider}|${baseUrl.toLowerCase()}|${model}`;
}

/** true → bu aday az önce hata verdi, soğuma süresi henüz bitmedi. */
export function isProviderDown(provider: string, baseUrl: string, model: string): boolean {
  const e = health.get(key(provider, baseUrl, model));
  return !!e && e.downUntil > Date.now();
}

/** Bir aday hata verdi → soğuma süresini işaretle (üst üste hatada üstel artar). */
export function markProviderDown(provider: string, baseUrl: string, model: string): void {
  const k = key(provider, baseUrl, model);
  const prev = health.get(k);
  const failCount = (prev?.failCount ?? 0) + 1;
  const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (failCount - 1), MAX_COOLDOWN_MS);
  health.set(k, { downUntil: Date.now() + cooldown, failCount });
}

/** Bir aday başarılı oldu → soğuma kaydını temizle (hemen "sağlıklı" sayılsın). */
export function markProviderUp(provider: string, baseUrl: string, model: string): void {
  health.delete(key(provider, baseUrl, model));
}

/** Adayları sağlık durumuna göre YENİDEN SIRALAR: bilinen sağlıklı olanlar
 *  önce, soğumadakiler sona. Hiçbir aday çıkarılmaz ve göreli sıra korunur
 *  (kararlı sıralama) — böylece birincil aday, sağlıklıysa yine ilk sırada
 *  kalır; sağlıksızsa bile listede kalır ve son çare olarak denenir. */
export function prioritizeHealthyCandidates<C extends { provider: string; baseUrl: string; model: string }>(
  candidates: C[],
): C[] {
  const healthy: C[] = [];
  const cooling: C[] = [];
  for (const c of candidates) {
    (isProviderDown(c.provider, c.baseUrl, c.model) ? cooling : healthy).push(c);
  }
  return [...healthy, ...cooling];
}

/* Yalnız testler için: durumu sıfırla. */
export function __resetProviderHealthForTests(): void {
  health.clear();
}
