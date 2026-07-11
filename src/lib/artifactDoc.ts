import type { Artifact } from "./types";

/* Metni HTML içine gömerken güvenli hâle getirir (& < > escape) — hem
   sözdizimi vurgulama (hljs, escaped text bekler) hem de düz metni bir
   <script>/<div> taşıyıcısına RAWTEXT-güvenli koymak için (</script> gibi
   kapatıcı diziler artık literal metin olarak kalmaz). textContent okurken
   taraycı otomatik geri çözer. */
function htmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Bir artifact'ı (html/svg/mermaid/code/markdown) sandbox iframe'de göstermek
   için tam HTML belgesi üretir. ArtifactPanel (canlı önizleme) ve /a/[id]
   (yayınlanan sayfa) AYNI mantığı kullanır → tutarlı render + tek kaynak. */
export function buildArtifactSrcDoc(type: Artifact["type"], content: string, language?: string): string {
  if (type === "mermaid") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script><style>body{margin:1.5rem;background:#fff;font-family:system-ui,sans-serif;}</style></head><body><div class="mermaid">${content}</div><script>mermaid.initialize({startOnLoad:true,theme:'default'});<\/script></body></html>`;
  }
  if (type === "svg") {
    return `<!DOCTYPE html><html><head><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111110;}</style></head><body>${content}</body></html>`;
  }
  if (type === "code") {
    const lang = (language || "plaintext").toLowerCase();
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/common.min.js"><\/script>
<style>body{margin:0;background:#0d1117;} pre{margin:0;padding:1.5rem;overflow:auto;min-height:100vh;box-sizing:border-box;} code{font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace!important;}</style>
</head><body><pre><code class="language-${lang}">${htmlEscape(content)}</code></pre>
<script>try{hljs.highlightAll();}catch(e){}<\/script></body></html>`;
  }
  if (type === "markdown") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>
<style>
body{margin:0;background:#fff;display:flex;justify-content:center;}
.doc{max-width:720px;width:100%;padding:3rem 2rem;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.75;font-size:17px;}
.doc h1,.doc h2,.doc h3{font-family:system-ui,-apple-system,sans-serif;font-weight:700;line-height:1.3;}
.doc h1{font-size:2rem;margin:0 0 1rem}
.doc h2{font-size:1.4rem;margin:2rem 0 .75rem}
.doc h3{font-size:1.15rem;margin:1.5rem 0 .5rem}
.doc p{margin:0 0 1.1rem}
.doc code{font-family:ui-monospace,monospace;background:#f2f1ed;padding:.15em .4em;border-radius:4px;font-size:.9em;}
.doc pre{background:#f2f1ed;padding:1rem;border-radius:8px;overflow:auto;}
.doc pre code{background:none;padding:0;}
.doc blockquote{border-left:3px solid #d97757;margin:0 0 1.1rem;padding:.1rem 0 .1rem 1.1rem;color:#555;}
.doc table{border-collapse:collapse;width:100%;margin:0 0 1.1rem;}
.doc th,.doc td{border:1px solid #e0ddd6;padding:.5rem .75rem;text-align:left;}
.doc ul,.doc ol{margin:0 0 1.1rem;padding-left:1.4rem;}
</style>
</head><body><div id="md-src" style="display:none">${htmlEscape(content)}</div><div class="doc" id="doc"></div>
<script>
var raw=document.getElementById('md-src').textContent;
document.getElementById('doc').innerHTML=marked.parse(raw);
<\/script></body></html>`;
  }
  /* html */
  return content.includes("<html")
    ? content
    : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem;}</style></head><body>${content}</body></html>`;
}

const CODE_EXT: Record<string, string> = {
  python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts",
  go: "go", golang: "go", rust: "rs", rs: "rs", java: "java", c: "c", cpp: "cpp",
  "c++": "cpp", csharp: "cs", "c#": "cs", ruby: "rb", rb: "rb", php: "php",
  swift: "swift", kotlin: "kt", bash: "sh", sh: "sh", shell: "sh", sql: "sql",
  yaml: "yml", yml: "yml", json: "json", jsx: "jsx", tsx: "tsx",
};

/* İndirme için uzantı + gövde (html'de tam belge, diğerlerinde ham içerik). */
export function artifactDownload(type: Artifact["type"], content: string, language?: string): { ext: string; body: string } {
  const ext =
    type === "svg" ? "svg" :
    type === "mermaid" ? "mmd" :
    type === "markdown" ? "md" :
    type === "code" ? (CODE_EXT[(language || "").toLowerCase()] ?? "txt") :
    "html";
  const body = type === "html" ? buildArtifactSrcDoc(type, content) : content;
  return { ext, body };
}
