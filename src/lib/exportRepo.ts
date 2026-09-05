/* "GitHub'a gönder" — saf mantık.
   Bileşenden ayrı tutuluyor ki vitest (environment: node, jsdom yok) doğrudan
   sınayabilsin — CLAUDE.md'deki "saf mantığı lib/'e çıkar" kuralı. */

import { buildArtifactSrcDoc } from "./artifactDoc";
import type { Artifact } from "./types";

/** Bir artifact başlığından GitHub'ın kabul edeceği depo adı üretir.
    Kural seti bilinçli olarak DAR: yalnız küçük harf, rakam, tire. GitHub
    nokta/alt çizgi de kabul eder ama URL'de ve ekranda en temiz okunan bu. */
export function repoSlug(title: string | undefined, fallback = "umai-app"): string {
  const s = (title ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // aksanları at (ş→s, ğ→g, ü→u)
    .replace(/ı/g, "i")                  // NFD "ı"yı ayrıştırmaz — elle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s.length >= 2 ? s : fallback;
}

export interface RepoFile { path: string; content: string }

/** Artifact'ı depoya yazılacak dosyalara çevirir.
    Görsel türler (html/svg/mermaid) tek başına açılabilen bir index.html'e
    gömülür — GitHub Pages'e koyunca doğrudan çalışsın diye. Kod/markdown ham
    dosya olarak gider. Her depoya kısa bir README eklenir: hem "bu ne?"
    sorusunu cevaplar hem de prompt.md Hamle 3'teki paylaşım döngüsünü
    ("bununla üretildi, sen de bedava dene") taşır. */
export function filesForArtifact(a: Artifact, appUrl = "https://umai.app"): RepoFile[] {
  const title = a.title?.trim() || "UMAI ile üretildi";
  const files: RepoFile[] = [];

  if (a.type === "html" || a.type === "svg" || a.type === "mermaid") {
    files.push({ path: "index.html", content: buildArtifactSrcDoc(a.type, a.content, a.language) });
    if (a.type === "svg") files.push({ path: "image.svg", content: a.content });
    if (a.type === "mermaid") files.push({ path: "diagram.mmd", content: a.content });
  } else if (a.type === "markdown") {
    files.push({ path: "document.md", content: a.content });
  } else {
    const ext = CODE_EXT[(a.language ?? "").toLowerCase()] ?? "txt";
    files.push({ path: `main.${ext}`, content: a.content });
  }

  files.push({
    path: "README.md",
    content:
      `# ${title}\n\n` +
      (a.type === "html" || a.type === "svg" || a.type === "mermaid"
        ? `Tek dosyalık bir sayfa: \`index.html\`'i tarayıcıda aç ya da GitHub Pages ile yayımla.\n\n`
        : "") +
      `---\n\n*[UMAI](${appUrl}) ile üretildi — ücretsiz, kurulum yok, sınırsız.*\n`,
  });

  return files;
}

const CODE_EXT: Record<string, string> = {
  javascript: "js", js: "js", typescript: "ts", ts: "ts", tsx: "tsx", jsx: "jsx",
  python: "py", py: "py", go: "go", rust: "rs", java: "java", kotlin: "kt", swift: "swift",
  ruby: "rb", php: "php", c: "c", cpp: "cpp", "c++": "cpp", csharp: "cs", "c#": "cs",
  sql: "sql", bash: "sh", sh: "sh", shell: "sh", css: "css", html: "html", json: "json",
  yaml: "yml", yml: "yml", toml: "toml", dart: "dart", lua: "lua", r: "r", scala: "scala",
};
