import type { ModelProfile, Provider } from "./types";
import { POLLINATIONS_DEFAULT_MODEL } from "./constants";

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
  return `${c.provider}|${c.baseUrl}|${c.model}`;
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
  }

  return out.slice(0, maxFallbacks);
}
