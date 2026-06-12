import type { Provider } from "./types";

// ── Varsayılan Sistem Promptu ──

export const DEFAULT_SYSTEM_PROMPT = `Sen Craft.Coder, deneyimli bir yazılım geliştirme asistanısın. Kod yazabilir, açıklayabilir, hata ayıklayabilir, mimari önerebilirsin. Kullanıcı sana GitHub deposundan dosya içeriği gösterebilir; bunları dikkate al. Adım adım düşün. Cevapların Türkçe ve markdown formatında olsun; kod bloklarını dilini belirterek yaz. Bir dosya içeriği yazarken code-fence'i \`dil:dosya/yolu\` biçiminde başlat (örn. \` \`\`\`ts:src/utils/helper.ts \`\`\`\`), böylece editörde otomatik açılabilsin.

Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun.`;

// ── Model Sağlayıcı Konfigürasyonu ──

export const PROVIDER_DEFAULTS: Record<Provider, {
  label: string;
  baseUrl: string;
  needsApiKey: boolean;
}> = {
  hf:          { label: "Hugging Face",   baseUrl: "https://router.huggingface.co/v1", needsApiKey: true },
  openai:      { label: "OpenAI",         baseUrl: "https://api.openai.com/v1",        needsApiKey: true },
  anthropic:   { label: "Anthropic",      baseUrl: "https://api.anthropic.com/v1",     needsApiKey: true },
  openrouter:  { label: "OpenRouter",     baseUrl: "https://openrouter.ai/api/v1",     needsApiKey: true },
  deepseek:    { label: "DeepSeek",       baseUrl: "https://api.deepseek.com/v1",      needsApiKey: true },
  groq:        { label: "Groq",           baseUrl: "https://api.groq.com/openai/v1",   needsApiKey: true },
  google:      { label: "Google Gemini",  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", needsApiKey: true },
  mistral:     { label: "Mistral",        baseUrl: "https://api.mistral.ai/v1",        needsApiKey: true },
  cerebras:    { label: "Cerebras",       baseUrl: "https://api.cerebras.ai/v1",       needsApiKey: true },
  together:    { label: "Together AI",    baseUrl: "https://api.together.xyz/v1",      needsApiKey: true },
  xai:         { label: "xAI (Grok)",     baseUrl: "https://api.x.ai/v1",              needsApiKey: true },
  ollama:      { label: "Ollama (yerel)", baseUrl: "http://localhost:11434/v1",        needsApiKey: false },
  pollinations:{ label: "Pollinations",   baseUrl: "https://text.pollinations.ai/openai", needsApiKey: false },
  custom:      { label: "Özel",           baseUrl: "",                                  needsApiKey: false },
};

// ── Hız Sınırlandırma ──

export const RATE_LIMIT = {
  chatPerMinute: 120,
  chatPerMinuteFree: 10,
  searchPerMinute: 5,
  suggestPerMinute: 10,
  sharePerMinute: 5,
};

// ── Bağlam Penceresi ──

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000;
export const MIN_CONTEXT_WINDOW_TOKENS = 4_000;
export const MAX_CONTEXT_WINDOW_TOKENS = 2_000_000;

// ── Ajan Limitleri ──

export const MAX_PARALLEL_AGENTS = 4;
export const MAX_SUBAGENT_TOKENS = 32_000;

// ── Dosya Limitleri ──

export const MAX_FILE_SIZE_BYTES = 500_000;
export const MAX_FILES_PER_READ = 10;
export const MAX_PATHS_GREP = 60;

// ── Site ──

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app";
export const SITE_NAME = "Craft.Coder";
