import { DEFAULT_SYSTEM_PROMPT } from "./constants";

/**
 * Skill ve referans dosyaları sistem prompt'una ekler.
 * Skills: [Eğitim seti] başlığı altında
 * Dosya skill'leri: [Referans dosyalar] başlığı altında
 */

interface SkillLike {
  title: string;
  content: string;
  source?: "manual" | "file";
}

interface PromptOptions {
  skills?: SkillLike[];
  searchContext?: string;
  projectPrompt?: string;
  customSystemPrompt?: string;
  memories?: { content: string }[];
  skillSections?: { title: string; content: string }[];
  repoRules?: string;
}

/**
 * Ana sistem prompt'unu tüm eklentilerle birleştirir.
 */
export function buildSystemPrompt(opts: PromptOptions): string {
  const parts: string[] = [];

  // 1. Temel prompt
  const base = opts.customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  parts.push(base);

  // 2. Search context (web arama sonucu)
  if (opts.searchContext?.trim()) {
    parts.push(`\n[Arama sonucu]:\n${opts.searchContext}`);
  }

  // 3. Anılar
  if (opts.memories?.length) {
    parts.push(`\n[Hafıza]:\n${opts.memories.map((m) => `- ${m.content}`).join("\n")}`);
  }

  // 4. Skill bölümleri
  const manualSkills = (opts.skills || []).filter((s) => s.source !== "file");
  const fileSkills = (opts.skills || []).filter((s) => s.source === "file");

  if (manualSkills.length > 0) {
    parts.push(`\n[Eğitim seti]:`);
    for (const sk of manualSkills) {
      parts.push(`--- ${sk.title} ---\n${sk.content}`);
    }
  }

  if (fileSkills.length > 0) {
    parts.push(`\n[Referans dosyalar — örnek olarak kullan]:`);
    for (const sk of fileSkills) {
      parts.push(`--- ${sk.title} ---\n${sk.content}`);
    }
  }

  // 5. Ek skill bölümleri
  if (opts.skillSections?.length) {
    for (const sec of opts.skillSections) {
      parts.push(`\n[${sec.title}]:\n${sec.content}`);
    }
  }

  // 6. Proje bağlamı
  if (opts.projectPrompt?.trim()) {
    parts.push(`\n[Proje bağlamı — SOUL.md]:\n${opts.projectPrompt}`);
  }

  // 7. Repo .rules
  if (opts.repoRules?.trim()) {
    parts.push(`\n[Proje kuralları — .rules]:\n${opts.repoRules}`);
  }

  return parts.join("\n");
}

/**
 * Karşılaştırma (compare) modunda kullanılan, araç çağrısı yapmayan, yalnızca yanıt üreten prompt.
 */
export function buildComparePrompt(): string {
  return `Sen kısa ve öz karşılaştırmalar yapan bir asistansın. Verilen iki model çıktısını karşılaştır, farkları ve benzerlikleri sırala. Tarafsız ol.`;
}
