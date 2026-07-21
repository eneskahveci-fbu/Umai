/* Kısa ömürlü bellek-içi önbellek: repo dosya ağacı + SOUL.md + package.json/
   .gitignore içeriği. İki kazanç: (1) GitHub/GitLab API'sine ardışık mesajlarda
   gereksiz tekrar istek atılmasını önler, (2) daha önemlisi — bu içerik
   sistem promptuna metin olarak enjekte edildiğinden, ardışık turlar arasında
   BAYT-BAYT AYNI kalmasını garanti ederek Anthropic'in prompt caching'inin
   (bkz. anthropic.ts) gerçekten isabet etmesini sağlar; içerik ufacık bile
   değişse (ör. API'nin dosya sırasını değiştirmesi) önbellek ıskalar ve tüm
   sistem promptu yeniden tam fiyata faturalanır.

   rate-limit.ts'teki AYNI bellek-içi Map deseni: çoklu-instance/soğuk-
   başlangıçta sıfırlanır — kabul edilebilir (kalıcı bir depo/Redis projenin
   "az bağımlılık" felsefesiyle çelişir, bkz. CLAUDE.md altyapı turu kararı).
   TTL kısa tutuldu: repo ağacı birkaç dakika içinde pratikte hiç değişmez,
   ama farklı kullanıcıların AYNI repo+dal için (ör. erişimi az önce iptal
   edilmiş biri) bayat/yetkisiz veri görme riskini düşük tutar. Anahtar
   yalnızca owner/repo/branch/provider'dan kurulur — token'lar KESİNLİKLE
   anahtara veya değere dahil edilmez. */

const TTL_MS = 3 * 60 * 1000;

interface CacheEntry<T> { value: T; expiresAt: number }
const store = new Map<string, CacheEntry<unknown>>();

export function repoCacheKey(
  ctx: { provider?: string; owner: string; repo: string; branch: string },
  kind: "tree" | "soul" | "pkg" | "gitignore",
): string {
  return `${kind}:${ctx.provider ?? "github"}:${ctx.owner}/${ctx.repo}@${ctx.branch}`;
}

/** `fn` sonucunu `key` altında TTL_MS boyunca önbellekler. Hata durumunda
    hiçbir şey önbelleklenmez (yalnız başarılı sonuçlar saklanır) — geçici bir
    API hatası birkaç dakika boyunca tekrar tekrar dönmez. */
export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expiresAt: now + TTL_MS });
  /* Map sınırsız büyümesin — her yazımda süresi geçmiş girdileri ayıkla. */
  if (store.size > 500) {
    for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
  }
  return value;
}
