import type { ModelProfile, Provider } from "./types";
import { POLLINATIONS_DEFAULT_MODEL, OVH_FREE_MODEL } from "./constants";

/**
 * Çok-sağlayıcılı otomatik fallback zinciri.
 *
 * Aktif model bir hata (kota/429, erişim/403, sunucu/5xx, bağlantı) verdiğinde
 * istek düşmek yerine sıradaki ÜCRETSİZ sağlayıcıya otomatik geçer. Her ücretsiz
 * sağlayıcının ayrı kotası olduğu için birleştirince kullanım "sınırsız" hissettirir.
 *
 * Bu modül saf (yan etkisiz) tutulur → birim testlerle doğrulanır. İstemci zinciri
 * kurar ve `/api/chat`'e `fallbacks` olarak yollar; sunucu sırayla dener.
 */
export interface FallbackCandidate {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/** Anahtar gerektirmeyen (anonim/yerel) sağlayıcılar — anahtarsız da denenebilir. */
export const KEYLESS_PROVIDERS: ReadonlySet<Provider> = new Set<Provider>([
  "pollinations",
  "ovh",
  "ollama",
  "custom",
]);

/**
 * Fallback olarak tercih sırası (küçük = önce denenir). Güvenilir + cömert ücretsiz
 * katmanları öne alır; ücretli/kişisel sağlayıcılar sona kalır. Listede olmayan
 * sağlayıcılar varsayılan orta öncelik alır.
 */
const PROVIDER_RANK: Partial<Record<Provider, number>> = {
  gemini: 0, // Sonnet seviyesi, çok cömert ücretsiz kota
  groq: 1, // çok hızlı, ücretsiz
  cerebras: 2, // hızlı, ücretsiz
  nvidia: 2.5, // NVIDIA NIM — ücretsiz, geniş açık model kataloğu
  github: 3, // GitHub Models — ücretsiz
  openrouter: 4, // birçok ücretsiz model
  pollinations: 5, // anahtarsız taban
  ovh: 5.5, // anahtarsız (anonim 2 istek/dk — paylaşımlı, bu yüzden tabandan sonra)
  mistral: 6,
  together: 7,
  deepseek: 8,
  hf: 9,
  openai: 10,
  xai: 11,
  anthropic: 12,
  ollama: 13, // yerel; sunucudan erişilemeyebilir → sona
  custom: 14,
};

function rank(p: Provider): number {
  return PROVIDER_RANK[p] ?? 7;
}

function isUsable(m: { provider: Provider; baseUrl?: string; model?: string; apiKey?: string }): boolean {
  if (!m.baseUrl || !m.model) return false;
  // Anahtar gerektiren sağlayıcı için anahtar şart; anahtarsızlar serbest.
  if (!KEYLESS_PROVIDERS.has(m.provider) && !m.apiKey) return false;
  return true;
}

function dedupeKey(c: FallbackCandidate): string {
  /* baseUrl büyük/küçük harfe duyarlı KARŞILAŞTIRILMIYOR — URL şeması/host'u
     RFC'ye göre zaten harf duyarsız (bkz. urlSafety.ts'teki aynı desen),
     yani kullanıcı aynı uç noktayı iki farklı harf biçimiyle girdiğinde
     (ör. elle eklenen özel sağlayıcı) bu iki profil TEKİLLEŞTİRİLMEDEN
     zincire ikisi de girer — sınırlı `maxFallbacks` yuvasından birini
     GERÇEKTEN FARKLI bir sağlayıcı yerine aynı uç noktaya tekrar denemeye
     harcar. */
  return `${c.provider}|${c.baseUrl.toLowerCase()}|${c.model}`;
}

export interface BuildChainOptions {
  /** Zincire eklenecek azami fallback sayısı (gecikmeyi sınırlar). */
  maxFallbacks?: number;
  /** Anahtarsız Pollinations tabanını her zaman ekle (varsayılan: true). */
  pollinationsBackstop?: boolean;
}

/**
 * Yapılandırılmış modellerden, aktif modeli HARİÇ tutarak sıralı bir fallback
 * listesi üretir. Sıra: ücretsiz/güvenilir sağlayıcılar önce. İstemcinin hiç
 * ücretsiz modeli yoksa bile anahtarsız Pollinations tabanı eklenir → her zaman
 * bir yedek vardır.
 */
export function buildFallbackChain(
  models: ModelProfile[],
  activeId: string | null,
  opts: BuildChainOptions = {},
): FallbackCandidate[] {
  const maxFallbacks = opts.maxFallbacks ?? 3;
  const pollinationsBackstop = opts.pollinationsBackstop ?? true;

  const active = models.find((m) => m.id === activeId) ?? null;
  const seen = new Set<string>();
  if (active) {
    seen.add(dedupeKey({ provider: active.provider, baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey }));
  }

  const candidates: FallbackCandidate[] = models
    .filter((m) => m.id !== activeId && isUsable(m))
    .map((m) => ({ provider: m.provider, baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey }))
    .sort((a, b) => rank(a.provider) - rank(b.provider));

  const out: FallbackCandidate[] = [];
  for (const c of candidates) {
    const key = dedupeKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }

  // Anahtarsız Pollinations tabanı: her zaman erişilebilir bir son çare.
  if (pollinationsBackstop) {
    const backstop: FallbackCandidate = {
      provider: POLLINATIONS_DEFAULT_MODEL.provider,
      baseUrl: POLLINATIONS_DEFAULT_MODEL.baseUrl,
      model: POLLINATIONS_DEFAULT_MODEL.model,
      apiKey: "",
    };
    if (!seen.has(dedupeKey(backstop))) {
      seen.add(dedupeKey(backstop));
      out.push(backstop);
    }
    /* İkinci anahtarsız halka: OVHcloud AI Endpoints (anonim, AB). Anonim
       oran sınırı IP başına 2 istek/dk olduğundan (sunucudan proxy'lenince
       PAYLAŞIMLI) Pollinations'ın ÖNÜNE geçmez — yalnız zincirde yer kaldıysa
       en sona eklenir; mevcut davranış değişmez, yedek derinleşir. */
    const ovh: FallbackCandidate = {
      provider: "ovh",
      baseUrl: OVH_FREE_MODEL.baseUrl,
      model: OVH_FREE_MODEL.model,
      apiKey: "",
    };
    if (!seen.has(dedupeKey(ovh))) {
      seen.add(dedupeKey(ovh));
      out.push(ovh);
    }
  }

  return out.slice(0, maxFallbacks);
}
