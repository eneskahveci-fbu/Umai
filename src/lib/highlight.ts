/* Shiki tabanlı sözdizimi vurgulama (VS Code temaları, TextMate grameri).
   Tek bir highlighter örneği önbelleğe alınır ve diller talep üzerine TEMBEL
   yüklenir; böylece yalnızca diff açıldığında ve yalnızca gereken dil/tema
   indirilir. Akış (streaming) sohbet hâlâ highlight.js kullanır — Shiki async
   olduğu için orada uygun değil. */

import type { Highlighter } from "shiki";

export interface Token {
  content: string;
  color?: string;
}

let hlPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();
const THEMES = ["github-dark", "github-light"] as const;
/* Aktif UI temasına göre Shiki teması — açık temada okunaklı tokenlar. */
function activeTheme(): (typeof THEMES)[number] {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) return "github-light";
  return "github-dark";
}

/* Monaco/dosya dil kimliğini Shiki dil kimliğine eşler. */
function shikiLang(language: string): string {
  const map: Record<string, string> = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    sh: "bash", shell: "bash", zsh: "bash", yml: "yaml",
    md: "markdown", py: "python", "c++": "cpp", "c#": "csharp",
  };
  return map[language] ?? language;
}

async function getHighlighter(lang: string): Promise<Highlighter | null> {
  try {
    if (!hlPromise) {
      const { createHighlighter } = await import("shiki");
      hlPromise = createHighlighter({ themes: [...THEMES], langs: [] });
    }
    const hl = await hlPromise;
    const target = shikiLang(lang);
    if (!loadedLangs.has(target)) {
      try {
        await hl.loadLanguage(target as Parameters<typeof hl.loadLanguage>[0]);
        loadedLangs.add(target);
      } catch {
        return null; /* bilinmeyen dil → düz metin */
      }
    }
    return hl;
  } catch {
    return null;
  }
}

/** Kodu satır satır renklendirilmiş token dizisine çevirir. Vurgulama
    yapılamazsa her satır tek renksiz token olarak döner (düz metin). */
export async function highlightLines(code: string, language: string): Promise<Token[][]> {
  const plain = (): Token[][] => code.split("\n").map((l) => [{ content: l }]);
  const hl = await getHighlighter(language);
  if (!hl) return plain();
  try {
    const { tokens } = hl.codeToTokens(code, {
      lang: shikiLang(language) as Parameters<typeof hl.codeToTokens>[1]["lang"],
      theme: activeTheme(),
    });
    return tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })));
  } catch {
    return plain();
  }
}
