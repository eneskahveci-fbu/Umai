import type { Config, Provider, ResponseStyle } from "./types";

export interface Preset {
  label: string;
  baseUrl: string;
  model: string;
  keyHint: string;
}

export const PRESETS: Record<Provider, Preset> = {
  hf: {
    label: "🤗 Hugging Face (router)",
    baseUrl: "https://router.huggingface.co/v1",
    model: "meta-llama/Llama-3.1-8B-Instruct",
    keyHint: "HF token (hf_...)",
  },
  deepseek: {
    label: "🐋 DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    keyHint: "DeepSeek anahtarı (sk-...)",
  },
  openrouter: {
    label: "🔀 OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.1-70b-instruct",
    keyHint: "OpenRouter anahtarı (sk-or-...)",
  },
  custom: {
    label: "⚙️ Özel (manuel URL)",
    baseUrl: "",
    model: "",
    keyHint: "ucun gerektiriyorsa anahtar",
  },
};

export const STYLE_LABELS: Record<ResponseStyle, { label: string; prompt: string }> = {
  normal: { label: "Normal", prompt: "" },
  concise: {
    label: "Kısa & Öz",
    prompt: "Yanıtlarını çok kısa ve öz tut. Gereksiz açıklama yapma, doğrudan sonuca git.",
  },
  detailed: {
    label: "Detaylı",
    prompt: "Yanıtlarını çok detaylı ve kapsamlı ver. Her adımı açıkla, örneklerle destekle.",
  },
  code: {
    label: "Kod Odaklı",
    prompt: "Önce kodu yaz, sonra kısaca açıkla. Gereksiz metin yerine çalışan kod ver.",
  },
  formal: {
    label: "Resmi",
    prompt: "Resmi ve profesyonel bir dil kullan. Teknik terimleri doğru kullan.",
  },
};

export const DEFAULT_SYSTEM_PROMPT =
  "Sen craft.ai, deneyimli bir yazılım geliştirme asistanısın. Kod yazabilir, " +
  "açıklayabilir, hata ayıklayabilir, mimari önerebilirsin. Kullanıcı sana GitHub " +
  "deposundan dosya içeriği gösterebilir; bunları dikkate al. Adım adım düşün. " +
  "Cevapların Türkçe ve markdown formatında olsun; kod bloklarını dilini belirterek yaz.";

export const SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;

export const DEFAULT_CONFIG: Config = {
  models: [],
  activeModelId: null,
  githubAccounts: [],
  activeGithubId: null,
  repos: ["eneskahveci-sdo/craft-ai"],
  activeRepo: "eneskahveci-sdo/craft-ai",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  theme: "dark",
  style: "normal",
  memories: [],
  projects: [],
  activeProjectId: null,
  followUps: true,
  webSearch: false,
  maxContext: 8192,
};

export const DEFAULT_REPO = "eneskahveci-sdo/craft-ai";
