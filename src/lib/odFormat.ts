/* Open Design (nexu-io/open-design) markdown formatları için hafif çözücüler.
   - DESIGN.md: `# Ad` + `> Category: X` + 9 bölümlük tasarım sözleşmesi
   - SKILL.md: YAML frontmatter (name/description + od.*) + serbest gövde
   Tam YAML kütüphanesi YOK — ihtiyaç duyulan alt küme toleranslı çözülür.
   Saf fonksiyonlar → birim testli. */

export interface ParsedSkillMd {
  name: string;
  description: string;
  mode?: string;
  examplePrompt?: string;
  /** Frontmatter'sız gövde (agent workflow'u). */
  body: string;
}

/** SKILL.md var mı? (--- frontmatter'lı ve name: alanı olan markdown) */
export function looksLikeSkillMd(md: string): boolean {
  const t = (md || "").trimStart();
  return t.startsWith("---") && /^name:\s*\S/m.test(t.slice(0, t.indexOf("---", 3) + 3));
}

export function parseSkillMd(md: string): ParsedSkillMd | null {
  const t = (md || "").trimStart();
  if (!t.startsWith("---")) return null;
  const end = t.indexOf("\n---", 3);
  if (end === -1) return null;
  const fm = t.slice(3, end);
  const body = t.slice(end + 4).replace(/^\s*\n/, "");
  const scalar = (key: string): string | undefined => {
    /* Düz `key: değer` veya blok `key: |` (ilk satırı al). od altındaki
       girintili alanlar için de çalışır. */
    const m = fm.match(new RegExp(`^\\s*${key}:\\s*(?:\\|\\s*\\n\\s+(.+)|["']?([^"'\\n]+)["']?)\\s*$`, "m"));
    return (m?.[1] ?? m?.[2])?.trim();
  };
  const name = scalar("name");
  if (!name) return null;
  return {
    name: name.slice(0, 60),
    description: (scalar("description") ?? "").slice(0, 300),
    mode: scalar("mode"),
    examplePrompt: scalar("example_prompt"),
    body,
  };
}
