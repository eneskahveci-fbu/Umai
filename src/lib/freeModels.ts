import type { Provider } from "./types";

/* Ücretsiz model tespiti — TEK kaynak (Eyl 2026 kullanıcı kararı: model adlarına
   "(Ücretsiz)" YAZILMAZ; ücretsiz olanlar tüm listelerde FREE_MODEL_CLASS
   rengiyle vurgulanır). Saf; UI'dan bağımsız test edilir. */

/** Kullanıcıdan ödeme istemeyen sağlayıcılar: anahtarsız (Pollinations, OVH),
    yerel (Ollama) ya da ücretsiz katmanı olan anahtarlı sağlayıcılar. */
export const FREE_PROVIDERS: ReadonlySet<Provider> = new Set<Provider>([
  "pollinations",
  "ovh",
  "ollama",
  "groq",
  "gemini",
  "cerebras",
  "github",
  "nvidia",
  "agnes",
]);

/** Model ücretsiz mi: ücretsiz sağlayıcı ya da OpenRouter tarzı ":free" sonekli ad. */
export function isFreeModel(provider: Provider, model?: string): boolean {
  if (FREE_PROVIDERS.has(provider)) return true;
  return !!model && model.trim().toLowerCase().endsWith(":free");
}

/** Ücretsiz modellerin vurgu rengi (Tailwind token — ana marka yeşilinden ayrışsın diye cyan). */
export const FREE_MODEL_CLASS = "text-cyan";
/** Yerel <option> öğeleri Tailwind sınıfı almaz — aynı renk CSS değişkeniyle. */
export const FREE_MODEL_COLOR = "var(--color-cyan)";
