// ── Sistem prompt'u birleştirici ──

import type { MemoryItem, SkillPayload } from "./types";
import { DEFAULT_SYSTEM_PROMPT } from "./constants";
import { PLATFORM_KNOWLEDGE } from "./platform-knowledge";

export { SkillPayload as SkillLike };

interface BuildContextOptions {
  systemPrompt?: string;
  memories?: MemoryItem[];
  skills?: SkillPayload[];
  searchContext?: string;
  projectPrompt?: string;
  repoInfo?: string;
}

/**
 * Tüm parçaları birleştirerek nihai sistem prompt'unu oluşturur.
 */
export function buildContextSections(opts: BuildContextOptions): string {
  const sections: string[] = [];

  // 1. Taban sistem prompt'u
  sections.push(opts.systemPrompt || DEFAULT_SYSTEM_PROMPT);

  // 2. Platform bilgisi
  if (opts.systemPrompt?.includes("Craft.Coder") || !opts.systemPrompt) {
    sections.push(PLATFORM_KNOWLEDGE);
  }

  // 3. Proje bağlamı
  if (opts.projectPrompt) {
    sections.push(`[Proje bağlamı — SOUL.md]:\n${opts.projectPrompt}`);
  }

  // 4. Repo bilgisi
  if (opts.repoInfo) {
    sections.push(`[Ajan modu — Repo: ${opts.repoInfo}]`);
  }

  // 5. Skills / referans dosyalar
  if (opts.skills && opts.skills.length > 0) {
    const manualSkills = opts.skills.filter((s) => s.source === "manual" || !s.source);
    const fileSkills = opts.skills.filter((s) => s.source === "file");

    if (manualSkills.length > 0) {
      sections.push(
        "[Eğitim seti]:\n" +
          manualSkills.map((s) => `--- ${s.title} ---\n${s.content}`).join("\n\n"),
      );
    }

    if (fileSkills.length > 0) {
      sections.push(
        "[Referans dosyalar — örnek olarak kullan]:\n" +
          fileSkills
            .map((s) => `--- ${s.fileName || s.title} ---\n${s.content}`)
            .join("\n\n"),
      );
    }
  }

  // 6. Anılar (memories)
  if (opts.memories && opts.memories.length > 0) {
    sections.push(
      "[Kullanıcı anıları]:\n" +
        opts.memories.map((m) => `- ${m.key}: ${m.value}`).join("\n"),
    );
  }

  // 7. Web arama bağlamı
  if (opts.searchContext) {
    sections.push(`[Web arama sonucu]:\n${opts.searchContext}`);
  }

  return sections.join("\n\n");
}
