/* URL'den skill içe aktarma — tek yol. İçerik SSRF+rate-limit korumalı
   /api/fetch-text proxy'sinden çekilir (CORS'a takılmaz), başlık içerikten
   türetilir, mevcut addSkill ile eklenir. Chat kesişimi ("skill indir <url>")
   ve SkillImport paneli aynı yardımcıyı kullanır. */
import { useStore } from "./store";
import { parseSkillMd, looksLikeSkillMd } from "./odFormat";

/** Başlığı içerikten türetir: ilk markdown başlığı > ilk anlamlı satır >
    URL dosya adı. 60 karaktere kırpılır. Saf — birim testli. */
export function deriveSkillTitle(text: string, url: string): string {
  const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && !l.startsWith("```"));
  const fromUrl = url.split("/").pop()?.replace(/\.(md|txt|markdown)$/i, "").replace(/[-_]+/g, " ").trim();
  const raw = heading || firstLine || fromUrl || "İçe aktarılan skill";
  return raw.replace(/^#+\s*/, "").slice(0, 60).trim();
}

/** URL'den skill indirir ve ekler. Hata fırlatır — çağıran dostane gösterir. */
export async function importSkillFromUrl(url: string): Promise<{ title: string; chars: number }> {
  const res = await fetch(`/api/fetch-text?url=${encodeURIComponent(url)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.text !== "string" || !data.text.trim()) {
    throw new Error(data.error || `İçerik alınamadı (HTTP ${res.status})`);
  }
  const text = (data.text as string).slice(0, 50_000);
  /* Open Design SKILL.md formatı: frontmatter'daki ad/açıklama kullanılır,
     gövde (workflow) skill içeriği olur — OD kayıt defterleri doğrudan uyumlu. */
  const od = looksLikeSkillMd(text) ? parseSkillMd(text) : null;
  const title = od?.name ?? deriveSkillTitle(text, url);
  const content = od ? (od.description ? `${od.description}\n\n${od.body}` : od.body) : text;
  useStore.getState().addSkill({
    title,
    content,
    tags: od ? ["içe-aktarılan", "open-design"] : ["içe-aktarılan"],
    enabled: true,
    source: "file",
    fileName: url,
  });
  return { title, chars: content.length };
}
