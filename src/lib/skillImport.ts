/* URL'den skill içe aktarma — tek yol. İçerik SSRF+rate-limit korumalı
   /api/fetch-text proxy'sinden çekilir (CORS'a takılmaz), başlık içerikten
   türetilir, mevcut addSkill ile eklenir. Chat kesişimi ("skill indir <url>")
   ve SkillImport paneli aynı yardımcıyı kullanır. */
import { useStore } from "./store";

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
  const title = deriveSkillTitle(text, url);
  useStore.getState().addSkill({
    title,
    content: text,
    tags: ["içe-aktarılan"],
    enabled: true,
    source: "file",
    fileName: url,
  });
  return { title, chars: text.length };
}
