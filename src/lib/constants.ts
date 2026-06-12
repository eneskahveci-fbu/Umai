// ── Sabitler ──

export const DEFAULT_SYSTEM_PROMPT = `Sen Craft.Coder, deneyimli bir yazılım geliştirme asistanısın. Kod yazabilir, açıklayabilir, hata ayıklayabilir, mimari önerebilirsin. Kullanıcı sana GitHub deposundan dosya içeriği gösterebilir; bunları dikkate al. Adım adım düşün. Cevapların Türkçe ve markdown formatında olsun; kod bloklarını dilini belirterek yaz. Bir dosya içeriği yazarken code-fence'i \`dil:dosya/yolu\` biçiminde başlat.

Sen uzman bir yazılım geliştiricisisin. Kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun.`;

export const MAX_FILES_PER_DIR = 200;
export const MAX_GREP_MATCHES = 100;
export const MAX_GREP_FILES = 60;
export const MAX_READ_FILES = 10;
export const MAX_AGENTS = 4;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 120;

export const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; name: string }> = {
  hf: { baseUrl: "https://router.huggingface.co/v1", name: "Hugging Face" },
  openai: { baseUrl: "https://api.openai.com/v1", name: "OpenAI" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", name: "Anthropic" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", name: "Google Gemini" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", name: "Mistral" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", name: "Groq" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", name: "DeepSeek" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", name: "OpenRouter" },
  cerebras: { baseUrl: "https://api.cerebras.ai/v1", name: "Cerebras" },
  togetherai: { baseUrl: "https://api.together.xyz/v1", name: "Together AI" },
  xai: { baseUrl: "https://api.x.ai/v1", name: "xAI Grok" },
  ollama: { baseUrl: "http://localhost:11434/v1", name: "Ollama" },
  pollinations: { baseUrl: "https://text.pollinations.ai/openai", name: "Pollinations" },
  custom: { baseUrl: "", name: "Özel" },
} as const;
