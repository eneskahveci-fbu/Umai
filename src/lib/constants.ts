// src/lib/constants.ts — Uygulama sabitleri ve varsayılanlar

import type { AIModel, AppConfig, ProviderKind, ResponseStyle } from "./types";

//─────── Provider defaults ───────
export const PROVIDER_DEFAULTS: Record<
  Exclude<ProviderKind, "custom" | "ollama">,
  string
> = {
  huggingface: "https://api-inference.huggingface.co",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  mistral: "https://api.mistral.ai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  togetherai: "https://api.together.xyz/v1",
  xai: "https://api.x.ai/v1",
};

export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  huggingface: "Hugging Face",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  groq: "Groq",
  google: "Google Gemini",
  mistral: "Mistral",
  cerebras: "Cerebras",
  togetherai: "Together AI",
  xai: "xAI (Grok)",
  ollama: "Ollama (Yerel)",
  custom: "Özel",
};

//─────── Default model listesi ───────
export const DEFAULT_MODELS: AIModel[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat V3",
    provider: "deepseek",
    apiKey: "",
    baseURL: PROVIDER_DEFAULTS.deepseek,
    enabled: false,
  },
];

//─────── App defaults ───────
export const DEFAULT_CONFIG: AppConfig = {
  theme: "dark",
  responseStyle: "normal",
  fontSize: 16,
  accentColor: "amber",
  soundEnabled: false,
  guestMode: false,
};

//─────── Response style prompts ───────
export const RESPONSE_STYLE_PROMPTS: Record<ResponseStyle, string> = {
  normal: "",
  short: "Kısa ve öz cevaplar ver. Gereksiz detaylardan kaçın.",
  detailed:
    "Detaylı, kapsamlı cevaplar ver. Adım adım açıkla. Örneklerle zenginleştir.",
  "code-focused":
    "Kod odaklı cevaplar ver. Açıklamaları kısa tut, kodu öne çıkar.",
  formal: "Resmi ve profesyonel bir dil kullan. Teknik terminolojiyi tercih et.",
};

//─────── API Limits ───────
export const RATE_LIMIT = {
  chat: { points: 30, duration: 60 }, // 30 req/dk
  github: { points: 15, duration: 60 },
  models: { points: 10, duration: 60 },
  share: { points: 5, duration: 60 },
  search: { points: 5, duration: 60 },
};

//─────── MAX TOKENS ───────
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_CONTEXT_WINDOW = 128_000;

//─────── Platform knowledge (özet) ───────
export const PLATFORM_KNOWLEDGE = `## Craft.Coder Platform Rehberi

GÖRÜNÜMLER
- Sohbet (Chat): Normal ve gizli sohbet
- Coder: Sol panelde dosya ağacı, Monaco editör + sohbet, terminal
- Karşılaştırma (Compare): Aynı istemi farklı modellerde karşılaştırma

AYARLAR
- Model: Çoklu sağlayıcı, API anahtarı yönetimi
- Git: Çoklu GitHub/GitLab hesabı
- Genel: Tema, yanıt stili, bellek
- Gelişmiş: Misafir mod, WebContainer API

SKILLS: Manuel ve dosya tabanlı skill'ler, Agents (slash komutları)

GÜVENLİK: API anahtarları yalnızca tarayıcıda saklanır`;

//─────── Slash commands ───────
export const SLASH_COMMANDS: Record<
  string,
  { description: string; prompt: string }
> = {
  explain: {
    description: "Kodu açıkla",
    prompt: "Şu kodu detaylıca açıkla, ne yaptığını adım adım anlat:",
  },
  refactor: {
    description: "Yeniden düzenle",
    prompt:
      "Bu kodu yeniden düzenle. Okunabilirliği artır, best practice'lere uygun hale getir:",
  },
  test: {
    description: "Test yaz",
    prompt:
      "Bu kod için kapsamlı testler yaz (Vitest). Edge case'leri ve hata durumlarını kapsa:",
  },
  fix: {
    description: "Hata ayıkla",
    prompt: "Bu koddaki hatayı bul ve düzelt. Ne sorunu olduğunu açıkla:",
  },
  review: {
    description: "Kod incele",
    prompt:
      "Bu kodu detaylıca incele. Güvenlik, performans, okunabilirlik açısından değerlendir:",
  },
  docs: {
    description: "Dokümantasyon yaz",
    prompt: "Bu kod için JSDoc/TSDoc formatında dokümantasyon yaz:",
  },
};

//─────── Built-in Skills ───────
export const BUILTIN_SKILL_FILES = [
  "typescript-kurallari",
  "nextjs-react-pratikleri",
  "tailwind-ui-tutarliligi",
  "guvenlik-gizlilik",
  "git-commit-hijyeni",
] as const;
