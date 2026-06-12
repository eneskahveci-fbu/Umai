import type { Skill } from "@/lib/types";

export type SkillLike = Pick<Skill, "title" | "content" | "source" | "fileName">;

interface BuildContextOptions {
  skills?: SkillLike[];
  memories?: { content: string }[];
  projectPrompt?: string;
  searchContext?: string;
  platformKnowledge?: string;
  repoSummary?: string;
}

/**
 * Sistem prompt'una eklenmek üzere bağlam bölümleri oluşturur.
 * Her bölüm ayrı XML-benzeri başlık altında gruplanır.
 */
export function buildContextSections(opts: BuildContextOptions): string {
  const sections: string[] = [];

  if (opts.platformKnowledge) {
    sections.push(`[Proje bağlamı — SOUL.md]:\n${opts.platformKnowledge}`);
  }

  if (opts.projectPrompt) {
    sections.push(`[Proje profili]\n${opts.projectPrompt}`);
  }

  if (opts.searchContext) {
    sections.push(`[Web arama sonucu]\n${opts.searchContext}`);
  }

  if (opts.repoSummary) {
    sections.push(`[Repo özeti]\n${opts.repoSummary}`);
  }

  if (opts.memories && opts.memories.length > 0) {
    const memText = opts.memories.map((m) => `- ${m.content}`).join("\n");
    sections.push(`[Kullanıcı notları / Bellek]\n${memText}`);
  }

  if (opts.skills && opts.skills.length > 0) {
    const manual = opts.skills.filter((s) => s.source === "manual");
    const file = opts.skills.filter((s) => s.source === "file");

    if (manual.length > 0) {
      const items = manual.map((s) => s.content).join("\n\n");
      sections.push(`[Eğitim seti]\n${items}`);
    }

    if (file.length > 0) {
      const items = file
        .map((s) => `--- ${s.fileName ?? s.title} ---\n${s.content}`)
        .join("\n\n");
      sections.push(`[Referans dosyalar — örnek olarak kullan]:\n${items}`);
    }
  }

  return sections.join("\n\n");
}
