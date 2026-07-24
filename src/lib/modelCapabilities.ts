/* Model yetenek algılama — "hangi modeli eklersem ekleyeyim, o modelin TÜM
   özelliklerinden faydalanmak istiyorum" isteğinin çekirdeği. ModelProfile
   (types.ts) yalnız {provider, model} taşır, hiçbir yetenek alanı yok —
   şimdiye kadar her özellik (jsonMode, tool desteği vb.) ayrı ayrı, dağınık
   sağlayıcı-adı kontrolleriyle "tahmin ediliyordu". Burası TEK, saf,
   test edilebilir bir sınıflandırıcı: provider + model adından (regex
   desenleri) gerçek API yeteneklerini çıkarır. Hem sunucu (api/chat/route.ts
   — gerçek davranışı değiştirmek için) hem istemci (SettingsModal.tsx —
   kullanıcıya rozet olarak GÖSTERMEK için) AYNI fonksiyonu kullanır; iki
   yer asla birbirinden sapmaz. Bilinmeyen/özel model adlarında (yerel/
   self-host) muhafazakâr (false) tarafa düşer — F2'nin "yanlış tahmin,
   sessiz JSON hatasından daha az kötüdür ama hâlâ risklidir" dersiyle aynı. */

import type { Provider } from "./types";

export interface ModelCapabilities {
  /** Görsel girdiyi (referans görsel, ekran görüntüsü) anlayabilir. */
  vision: boolean;
  /** Fonksiyon/araç çağırma (tool use) destekler. */
  tools: boolean;
  /** OpenAI-uyumlu native JSON modu (response_format:{type:"json_object"}). */
  jsonMode: boolean;
  /** Claude'a özgü genişletilmiş muhakeme (thinking budget_tokens). */
  extendedThinking: boolean;
  /** OpenAI'ın kendi reasoning_effort alanı (o-serisi/gpt-5 ailesi). */
  nativeReasoningEffort: boolean;
}

/* route.ts'teki JSON_MODE_PROVIDERS ile AYNI kaynak — iki yerde ayrı ayrı
   tutulup sapma riski olmasın diye burada tanımlanır, route.ts buradan alır.
   Set<string> (Set<Provider> değil): route.ts'teki Candidate.provider düz
   string (istemciden gelen fallback adayları rastgele metin taşıyabilir). */
export const JSON_MODE_PROVIDERS = new Set<string>([
  "openai", "groq", "together", "mistral", "deepseek", "xai", "openrouter", "github", "nvidia", "cerebras",
]);

/* Görsel (vision) girdi kabul ettiği bilinen model ailesi desenleri —
   sağlayıcıdan BAĞIMSIZ (openrouter/groq/together gibi geçiş sağlayıcıları
   onlarca farklı model ailesini aynı OpenAI-uyumlu yüzeyin ardında sunar;
   güvenilir sinyal sağlayıcı adı değil, model adının kendisidir). */
const VISION_MODEL_RE = /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|^o1|^o3|^o4|claude-3|claude-4|opus-4|sonnet-4|haiku-4|gemini|pixtral|llava|grok-4|grok-2-vision|grok-vision|qwen2(?:\.5)?-vl|qwen-vl|internvl|llama-3\.2.*vision|phi-3\.5-vision|phi-4.*vision/i;

/* Araç çağırmayı DESTEKLEMEDİĞİ bilinen (istisnai) model türleri — geri
   kalan her şey (modern chat modelleri) varsayılan olarak destekler sayılır;
   ham tamamlama/gömme/ses modelleri burada elenir. */
const NO_TOOLS_MODEL_RE = /embed|embedding|whisper|^tts-|^dall-e|davinci|babbage|^ada$|moderation|instruct$/i;

/* Claude'un genişletilmiş muhakemesi (extended thinking) yalnız 3.7+ ve 4.x
   ailesinde var — 3.5/3-opus/3-sonnet/3-haiku ve önceki nesillerde YOK. */
const CLAUDE_THINKING_RE = /claude-3-7|sonnet-4|opus-4|haiku-4/i;

/* OpenAI'ın reasoning_effort alanını kabul eden o-serisi + gpt-5 ailesi
   (gpt-5, gpt-5-mini, gpt-5-nano, o1, o3, o3-mini, o4-mini…). Düz gpt-4o/
   gpt-4.1/gpt-3.5 gibi "non-reasoning" modeller bu alanı reddedebilir. */
const OPENAI_REASONING_RE = /^o1|^o3|^o4|^gpt-5/i;

export type Effort = "low" | "medium" | "high" | "max";

/* Efor→max_tokens ve efor→thinking-bütçesi eşlemeleri — chat/route.ts VE
   orchestrate/route.ts AYNI kaynağı kullanır (J1/J3: önceden ikisi ayrı ayrı
   tanımlıyordu, orchestrate hiç thinking/native reasoning_effort göndermiyordu
   ve Anthropic'e YANLIŞ uç/gövde şekliyle istek atıyordu — bkz. anthropicUpstream
   çağrısı, orchestrate/route.ts). THINKING_BUDGET her zaman ilgili EFFORT_TOKENS
   tavanının altında (thinking + nihai yanıt birlikte max_tokens'ı aşamaz). */
export const EFFORT_TOKENS: Record<Effort, number> = { low: 4096, medium: 8192, high: 16384, max: 32768 };
export const THINKING_BUDGET: Record<Effort, number> = { low: 2048, medium: 6000, high: 12000, max: 24000 };

export function detectModelCapabilities(provider: Provider | string, model: string): ModelCapabilities {
  const m = (model || "").trim();
  const p = provider as Provider;

  const vision = VISION_MODEL_RE.test(m);
  const tools = !NO_TOOLS_MODEL_RE.test(m);
  const jsonMode = JSON_MODE_PROVIDERS.has(p);
  const extendedThinking = p === "anthropic" && CLAUDE_THINKING_RE.test(m);
  const nativeReasoningEffort = p === "openai" && OPENAI_REASONING_RE.test(m);

  return { vision, tools, jsonMode, extendedThinking, nativeReasoningEffort };
}
