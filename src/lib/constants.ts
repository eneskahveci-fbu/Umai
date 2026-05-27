import type { Config, Provider } from "./types";

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
};

export const DEFAULT_REPO = "eneskahveci-sdo/craft-ai";
