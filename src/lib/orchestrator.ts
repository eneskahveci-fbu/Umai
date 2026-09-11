import type { Provider } from "./types";
import type { FallbackCandidate } from "./fallback";

/* Serbest-katman orkestratörü.
   Ücretsiz sağlayıcıların SON güvenilirliğini öğrenip fallback zincirini buna
   göre yeniden sıralar -> $0 ile en yüksek başarı. Saf sıralama (testli) + ince
   localStorage kalıcılığı (yan etki ayrı, SSR'de güvenle no-op).

   GÜVENLİK: config.freeOrchestrator KAPALIYKEN (varsayılan) fallback.ts'teki
   buildChainFor bu modülü hiç çağırmaz -> zincir birebir aynı sırada kalır,
   davranış değişmez. Tek entegrasyon noktası buildChainFor olduğu için (bkz.
   fallback.ts) her çağıran — CoderView, Studio, quickComplete, Fusion — flag
   açıldığında otomatik öğrenilmiş sırayı kullanır; ayrı ayrı tek tek
   değiştirilmesi gerekmez. */

export interface ProviderStat {
  /** Üstel hareketli ortalama başarı oranı [0..1]. */
  score: number;
  updatedAt: number;
  samples: number;
}
export type ProviderStats = Partial<Record<Provider, ProviderStat>>;

const EMA_ALPHA = 0.3; // yeni gözlemin ağırlığı
const NEUTRAL = 0.7; // bilinmeyen sağlayıcı için iyimser varsayılan
const STORE_KEY = "craftai_provider_stats";

/** Saf: bir gözlemi (başarılı mı?) mevcut istatistikle EMA ile birleştirir. */
export function updateStat(prev: ProviderStat | undefined, ok: boolean, now: number): ProviderStat {
  const base = prev?.score ?? NEUTRAL;
  const score = base + EMA_ALPHA * ((ok ? 1 : 0) - base);
  return {
    score: Math.max(0, Math.min(1, score)),
    updatedAt: now,
    samples: (prev?.samples ?? 0) + 1,
  };
}

/** Saf: adayları öğrenilmiş güvenilirliğe göre KARARLI biçimde yeniden sıralar
    (yüksek skor önce; eşitlikte/skorsuzda orijinal sıra korunur). Boş istatistikte
    her sağlayıcı NEUTRAL alır -> giriş sırası aynen korunur (güvenli no-op). */
export function orderByReliability(candidates: FallbackCandidate[], stats: ProviderStats): FallbackCandidate[] {
  const scoreOf = (p: Provider) => stats[p]?.score ?? NEUTRAL;
  return candidates
    .map((c, i) => ({ c, i, s: scoreOf(c.provider) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map((x) => x.c);
}

/* localStorage kalıcılığı (SSR/destek yoksa sessizce boş döner).
   In-memory önbellek: aynı pageload'da tekrarlanan localStorage okumalarını
   engeller (buildChainFor birden çok yerden art arda çağrılabilir). */
let _statsCache: ProviderStats | null = null;

export function loadStats(): ProviderStats {
  if (_statsCache) return { ..._statsCache };
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORE_KEY);
    _statsCache = raw ? (JSON.parse(raw) as ProviderStats) : {};
    return { ..._statsCache };
  } catch { return {}; }
}

function saveStats(s: ProviderStats): void {
  _statsCache = { ...s };
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch { /* yok say */ }
}

/** Bir sağlayıcı isteğinin sonucunu kaydeder (öğrenme sinyali). Ayarlar'daki
    "Test et" düğmesinden çağrılır — gerçek kullanıcı isteği değil, bilinçli
    bir bağlantı denemesi olduğu için gürültüsüz bir sinyal kaynağıdır. */
export function recordOutcome(provider: Provider, ok: boolean): void {
  const now = typeof Date !== "undefined" ? Date.now() : 0;
  const s = loadStats();
  s[provider] = updateStat(s[provider], ok, now);
  saveStats(s);
}

/** Doğrudan sınamak/kullanmak isteyen çağıranlar için: verilmiş bir zinciri,
    flag açıksa öğrenilmiş güvenilirliğe göre yeniden sıralar. Flag kapalıyken
    (varsayılan/undefined) girdiyi DEĞİŞTİRMEDEN döner. */
export function applyOrchestration(chain: FallbackCandidate[], enabled?: boolean): FallbackCandidate[] {
  if (!enabled) return chain;
  return orderByReliability(chain, loadStats());
}
