/* Model kimliği (R1).

   Sorun: CRAFT_OPERATING_MANUAL'daki eski kimlik çapası modele "kimliğin
   sorulursa YALNIZCA 'UMAI' de, hangi model olduğunu ASLA söyleme" diyordu.
   Bu çapa gerçek bir soruna karşı yazılmıştı — modeller kendi kimliklerini
   uyduruyordu (bir kullanıcı raporunda Gemini API'siyle çalışırken "ChatGPT
   4o" olduğunu iddia etti). Ama çözüm yanlış yerdeydi: modelin TAHMİN
   ETMESİNİ yasaklamak yerine ona GERÇEĞİ söylemek gerekiyordu. Sunucu zaten
   hangi sağlayıcı/modelin çözümlendiğini kesin biliyor.

   Bu modül ham model kimliğini (ör. "meta/llama-3.3-70b-instruct") okunabilir
   bir kimliğe çevirir ("Meta'nın Llama 3.3 70B Instruct modeli") ve sistem
   promptuna eklenecek bloğu üretir. Böylece kimlik sorusu tek ve doğru bir
   cevap alır, uydurma ihtimali kalmaz.

   Saf fonksiyonlar → birim testli. */

/** Modeli ÜRETEN kurum (isteği taşıyan sağlayıcıdan farklı olabilir: Llama'yı
    Meta üretir, NVIDIA NIM yalnızca sunar). Türkçe iyelik eki kurala
    bağlanamayacak kadar düzensiz olduğundan (Anthropic'in / Meta'nın /
    OpenAI'ın) hesaplanmaz, tabloda tutulur. */
interface Vendor { name: string; possessive: string }

const VENDORS: { re: RegExp; vendor: Vendor }[] = [
  { re: /^claude/i, vendor: { name: "Anthropic", possessive: "Anthropic'in" } },
  { re: /^(gpt|o1|o3|o4|chatgpt|davinci|codex)/i, vendor: { name: "OpenAI", possessive: "OpenAI'ın" } },
  { re: /^(gemini|gemma)/i, vendor: { name: "Google", possessive: "Google'ın" } },
  { re: /^(llama|codellama)/i, vendor: { name: "Meta", possessive: "Meta'nın" } },
  { re: /^(mistral|mixtral|magistral|ministral|codestral|devstral|pixtral)/i, vendor: { name: "Mistral AI", possessive: "Mistral AI'ın" } },
  { re: /^qwen/i, vendor: { name: "Alibaba Qwen", possessive: "Alibaba Qwen'in" } },
  { re: /^deepseek/i, vendor: { name: "DeepSeek", possessive: "DeepSeek'in" } },
  { re: /^grok/i, vendor: { name: "xAI", possessive: "xAI'ın" } },
  { re: /^command/i, vendor: { name: "Cohere", possessive: "Cohere'in" } },
  { re: /^phi/i, vendor: { name: "Microsoft", possessive: "Microsoft'un" } },
  { re: /^nemotron/i, vendor: { name: "NVIDIA", possessive: "NVIDIA'nın" } },
  { re: /^glm/i, vendor: { name: "Zhipu AI", possessive: "Zhipu AI'ın" } },
  { re: /^kimi/i, vendor: { name: "Moonshot AI", possessive: "Moonshot AI'ın" } },
  { re: /^granite/i, vendor: { name: "IBM", possessive: "IBM'in" } },
  { re: /^falcon/i, vendor: { name: "TII", possessive: "TII'nin" } },
  { re: /^olmo/i, vendor: { name: "AI2", possessive: "AI2'nin" } },
  { re: /^agnes/i, vendor: { name: "Agnes AI", possessive: "Agnes AI'ın" } },
];

/** Model kimliğinin başındaki kurum öneki (ör. "meta/llama-…", "Qwen/Qwen2.5-…"). */
const ORG_PREFIX: Record<string, Vendor> = {
  meta: { name: "Meta", possessive: "Meta'nın" },
  "meta-llama": { name: "Meta", possessive: "Meta'nın" },
  google: { name: "Google", possessive: "Google'ın" },
  openai: { name: "OpenAI", possessive: "OpenAI'ın" },
  anthropic: { name: "Anthropic", possessive: "Anthropic'in" },
  mistralai: { name: "Mistral AI", possessive: "Mistral AI'ın" },
  qwen: { name: "Alibaba Qwen", possessive: "Alibaba Qwen'in" },
  deepseek: { name: "DeepSeek", possessive: "DeepSeek'in" },
  nvidia: { name: "NVIDIA", possessive: "NVIDIA'nın" },
  microsoft: { name: "Microsoft", possessive: "Microsoft'un" },
  moonshotai: { name: "Moonshot AI", possessive: "Moonshot AI'ın" },
  "x-ai": { name: "xAI", possessive: "xAI'ın" },
  cohere: { name: "Cohere", possessive: "Cohere'in" },
  ibm: { name: "IBM", possessive: "IBM'in" },
  "z-ai": { name: "Zhipu AI", possessive: "Zhipu AI'ın" },
};

/** İsteği TAŞIYAN sağlayıcının okunur adı (PRESETS.label emoji ve pazarlama
    metni içerdiği için prompt'a uygun değil — burada sade karşılığı tutulur). */
const ROUTE_LABELS: Record<string, string> = {
  anthropic: "Anthropic API",
  openai: "OpenAI API",
  hf: "Hugging Face router",
  deepseek: "DeepSeek API",
  openrouter: "OpenRouter",
  groq: "Groq",
  gemini: "Google AI Studio",
  mistral: "Mistral API",
  cerebras: "Cerebras",
  together: "Together AI",
  xai: "xAI API",
  pollinations: "Pollinations",
  ovh: "OVHcloud AI Endpoints",
  github: "GitHub Models",
  nvidia: "NVIDIA NIM",
  agnes: "Agnes AI",
  ollama: "Ollama (kullanıcının kendi bilgisayarı)",
  local: "yerel uç nokta",
  custom: "özel uç nokta",
};

/* Pollinations model kimlikleri gerçek model adı DEĞİL, takma addır
   ("openai", "mistral", "llama"…); arkadaki gerçek model açıklanmaz ve
   zamanla değişebilir. Bunları gerçek model adı gibi sunmak [DÜRÜSTLÜK]
   ilkesine aykırı olurdu — ayrıca işaretlenir. */
const ALIAS_ONLY_PROVIDERS = new Set(["pollinations"]);

const KNOWN_CASING: Record<string, string> = {
  gpt: "GPT", oss: "OSS", ai: "AI", vl: "VL", moe: "MoE", nim: "NIM",
  /* OpenAI muhakeme serisi ürün adında küçük harftir ("o3-mini"). */
  o1: "o1", o3: "o3", o4: "o4",
  deepseek: "DeepSeek", openai: "OpenAI", qwen: "Qwen", xai: "xAI",
  glm: "GLM", ibm: "IBM", tii: "TII", olmo: "OLMo", r1: "R1", v3: "V3",
};

function prettyToken(t: string): string {
  const low = t.toLowerCase();
  if (KNOWN_CASING[low]) return KNOWN_CASING[low];
  if (/^\d+(\.\d+)?[bkm]$/i.test(t)) return t.toUpperCase();  // 70b → 70B
  if (/^\d/.test(t)) return t;                                 // 3.3, 4.1 — dokunma
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Ham model kimliğini okunur bir ada çevirir. */
export function prettyModelName(rawModel: string): string {
  let id = (rawModel || "").trim();
  if (!id) return "";

  /* OpenRouter varyant ekleri (":free", ":nitro"…) model adının parçası
     değil, yönlendirme tercihidir. */
  id = id.replace(/:(free|nitro|floor|beta|extended|thinking)$/i, "");
  /* Kurum öneki ("meta/llama-…") — ad için gereksiz, vendor'da zaten var. */
  const slash = id.lastIndexOf("/");
  if (slash >= 0) id = id.slice(slash + 1);

  /* Claude sürümleri tire ile yazılır ama nokta okunur: claude-opus-4-8. */
  const claude = /^claude-(opus|sonnet|haiku|fable)-(\d+)-(\d+)$/i.exec(id);
  if (claude) {
    const fam = claude[1].charAt(0).toUpperCase() + claude[1].slice(1).toLowerCase();
    return `Claude ${fam} ${claude[2]}.${claude[3]}`;
  }
  const claude3 = /^claude-3-(\d)-(opus|sonnet|haiku)/i.exec(id);
  if (claude3) {
    const fam = claude3[2].charAt(0).toUpperCase() + claude3[2].slice(1).toLowerCase();
    return `Claude 3.${claude3[1]} ${fam}`;
  }

  /* "…-latest" sabit bir sürüm değil, sağlayıcının o anki güncel sürümüne
     işaret eden takma addır — sürüm numarası uydurulmasın diye açıkça yazılır. */
  let latest = false;
  if (/-latest$/i.test(id)) { latest = true; id = id.replace(/-latest$/i, ""); }

  const name = id
    .split(/[-_]/)
    .filter(Boolean)
    .map(prettyToken)
    .reduce((acc, tok) => {
      /* "GPT 4.1" değil "GPT-4.1", "o3 Mini" değil "o3-mini" — ürün adları
         böyle yazılıyor. */
      if (acc.endsWith("GPT") && /^\d/.test(tok)) return `${acc}-${tok}`;
      if (/^o\d$/.test(acc)) return `${acc}-${tok.toLowerCase()}`;
      return acc ? `${acc} ${tok}` : tok;
    }, "");

  return latest ? `${name} (güncel sürüm)` : name;
}

export interface ModelIdentity {
  /** Okunur model adı (ör. "Llama 3.3 70B Instruct"). */
  name: string;
  /** Modeli üreten kurum — çözülemezse undefined. */
  vendor?: Vendor;
  /** İsteği taşıyan sağlayıcının okunur adı. */
  route: string;
  /** Model kimliği gerçek bir modeli mi gösteriyor, yoksa takma ad mı. */
  alias: boolean;
}

export function describeModel(provider: string, model: string): ModelIdentity {
  const raw = (model || "").trim();
  const route = ROUTE_LABELS[provider] || provider || "bilinmeyen sağlayıcı";
  const alias = ALIAS_ONLY_PROVIDERS.has(provider);

  let vendor: Vendor | undefined;
  const slash = raw.lastIndexOf("/");
  if (slash >= 0) vendor = ORG_PREFIX[raw.slice(0, slash).toLowerCase()];
  if (!vendor) {
    const bare = slash >= 0 ? raw.slice(slash + 1) : raw;
    vendor = VENDORS.find((v) => v.re.test(bare))?.vendor;
  }

  return { name: prettyModelName(raw), vendor: alias ? undefined : vendor, route, alias };
}

/** Sistem promptuna eklenecek [MODEL KİMLİĞİ] bloğu. Modelin kimliğini tahmin
    etmesini engellemek yerine ona GERÇEĞİ verir. */
export function buildIdentityPrompt(provider: string, model: string): string {
  const id = describeModel(provider, model);
  if (!id.name) {
    return "[MODEL KİMLİĞİ] Hangi model olduğun sorulursa: \"Umai platformunda çalışan bir yapay zekâ asistanıyım; " +
      "hangi modelin seçili olduğunu Ayarlar → Modeller'den görebilirsin\" de. Model adı UYDURMA.";
  }

  const who = id.alias
    ? `Pollinations'ın "${model}" takma adıyla sunduğu ücretsiz model`
    : id.vendor
      ? `${id.vendor.possessive} ${id.name} modeli`
      : `${id.name} modeli`;

  const example = id.alias
    ? `Umai platformunda çalışıyorum; Pollinations'ın "${model}" ücretsiz modeliyle yanıt veriyorum`
    : id.vendor
      ? `${id.vendor.possessive} ${id.name} modeliyim, Umai platformunda çalışıyorum`
      : `${id.name} modeliyim, Umai platformunda çalışıyorum`;

  const lines = [
    `[MODEL KİMLİĞİ] Sen ${who}sin ve Umai platformunda çalışıyorsun (istek ${id.route} üzerinden geçiyor).`,
    `Hangi model/kim olduğun sorulursa BU bilgiyi ver — tek cümlede, doğal biçimde (ör. "${example}").`,
    "Buradaki bilgi tek doğru kaynaktır: BAŞKA bir model/sürüm adı iddia etme, eğitim verinden hatırladığın kimliği kullanma.",
  ];
  if (id.alias) {
    /* Dürüstlük: takma adın arkasındaki gerçek model açıklanmıyor. */
    lines.push(`"${model}" bir takma addır; arkasındaki gerçek modeli Pollinations açıklamaz, bu yüzden kesin bir model adı verme.`);
  }
  return lines.join(" ");
}
