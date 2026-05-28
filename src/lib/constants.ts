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
    keyHint: "sk-...",
  },
  openrouter: {
    label: "🔀 OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.1-70b-instruct",
    keyHint: "OpenRouter anahtarı (sk-or-...)",
  },
  groq: {
    label: "Groq (Ücretsiz)",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "deepseek-r1-distill-llama-70b",
    keyHint: "gsk_...",
  },
  gemini: {
    label: "Google Gemini (Ücretsiz)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    keyHint: "AIza...",
  },
  ollama: {
    label: "Ollama (Yerel / Ücretsiz)",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5-coder:7b",
    keyHint: "ollama (boş bırakılabilir)",
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
  cliMode: false,
  autoTerminal: false,
  fontScale: "base",
  soundEnabled: false,
  accentColor: "purple",
  maxContext: 8192,
};

export const DEFAULT_REPO = "eneskahveci-sdo/craft-ai";

export const CODE_REVIEW_PROMPT =
  "Aşağıdaki kodu detaylı şekilde incele. Şu başlıklar altında bulgularını raporla:\n\n" +
  "## 🐛 Hatalar\nKodda olası bugları belirt.\n\n" +
  "## 🔒 Güvenlik\nGüvenlik açıklarını kontrol et (injection, XSS, hassas veri sızıntısı vb.).\n\n" +
  "## ⚡ Performans\nPerformans iyileştirme önerileri sun.\n\n" +
  "## ✅ En İyi Pratikler\nKod kalitesi, okunabilirlik, bakım kolaylığı önerileri ver.\n\n" +
  "Her bulgu için sorunun ciddiyetini (düşük/orta/yüksek) belirt ve düzeltme önerisi sun.";

import type { PromptTemplate } from "./types";

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Kod Yazma
  { id: "kw1", category: "Kod Yazma", title: "REST API endpoint", prompt: "Express.js ile bir REST API endpoint yaz. CRUD operasyonlarını içersin, hata yönetimi ve validasyon ekle." },
  { id: "kw2", category: "Kod Yazma", title: "React bileşeni", prompt: "TypeScript ile yeniden kullanılabilir bir React bileşeni yaz. Props arayüzünü tanımla, state yönetimi ekle." },
  { id: "kw3", category: "Kod Yazma", title: "Veritabanı şeması", prompt: "PostgreSQL için bir veritabanı şeması tasarla. Tablolar arası ilişkileri, indexleri ve constraintleri belirt." },
  { id: "kw4", category: "Kod Yazma", title: "CLI aracı", prompt: "Node.js ile bir komut satırı aracı yaz. Argüman ayrıştırma, renkli çıktı ve yardım menüsü ekle." },

  // Hata Ayıklama
  { id: "ha1", category: "Hata Ayıklama", title: "Hata mesajı analizi", prompt: "Şu hata mesajını analiz et ve olası çözümlerini açıkla:\n\n```\n[Hata mesajını buraya yapıştır]\n```" },
  { id: "ha2", category: "Hata Ayıklama", title: "Performans sorunu", prompt: "Bu kodda performans sorunu var. Darboğazları tespit et ve optimizasyon önerileri sun:\n\n```\n[Kodu buraya yapıştır]\n```" },
  { id: "ha3", category: "Hata Ayıklama", title: "Memory leak tespiti", prompt: "Bu kodda memory leak olup olmadığını kontrol et. Varsa nedenini açıkla ve düzeltme öner:\n\n```\n[Kodu buraya yapıştır]\n```" },

  // Açıklama
  { id: "ac1", category: "Açıklama", title: "Kod açıklama", prompt: "Bu kodu satır satır açıkla. Her fonksiyonun ne yaptığını, karmaşık mantığı ve kullanılan desenleri belirt:\n\n```\n[Kodu buraya yapıştır]\n```" },
  { id: "ac2", category: "Açıklama", title: "Algoritma açıklama", prompt: "Bu algoritmayı adım adım açıkla. Zaman ve alan karmaşıklığını analiz et, görsel örneklerle destekle." },
  { id: "ac3", category: "Açıklama", title: "Mimari açıklama", prompt: "Bu projenin mimarisini açıkla. Bileşenler arası ilişkileri, veri akışını ve tasarım kararlarını belirt." },

  // Refaktöring
  { id: "rf1", category: "Refaktöring", title: "Temiz kod dönüşümü", prompt: "Bu kodu SOLID prensiplerine uygun şekilde refaktör et. Okunabilirliği artır, tekrarlanan kodu azalt:\n\n```\n[Kodu buraya yapıştır]\n```" },
  { id: "rf2", category: "Refaktöring", title: "TypeScript dönüşümü", prompt: "Bu JavaScript kodunu TypeScript'e dönüştür. Tip tanımlamalarını, arayüzleri ve generic'leri ekle:\n\n```\n[Kodu buraya yapıştır]\n```" },
  { id: "rf3", category: "Refaktöring", title: "Modern sözdizimi", prompt: "Bu kodu modern JavaScript/TypeScript söz dizimine güncelle. async/await, destructuring, optional chaining kullan:\n\n```\n[Kodu buraya yapıştır]\n```" },

  // Test
  { id: "ts1", category: "Test", title: "Birim test yaz", prompt: "Bu fonksiyon için kapsamlı birim testleri yaz. Edge case'leri, hata senaryolarını ve normal akışı test et:\n\n```\n[Kodu buraya yapıştır]\n```" },
  { id: "ts2", category: "Test", title: "Entegrasyon testi", prompt: "Bu API endpoint için entegrasyon testleri yaz. Başarılı ve başarısız senaryoları, validasyon hatalarını test et." },
  { id: "ts3", category: "Test", title: "Test stratejisi", prompt: "Bu proje için bir test stratejisi öner. Hangi testler yazılmalı, test kapsamı ne olmalı, hangi araçlar kullanılmalı?" },
];
