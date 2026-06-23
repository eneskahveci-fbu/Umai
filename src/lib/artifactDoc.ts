import type { Artifact } from "./types";

/* Bir artifact'ı (html/svg/mermaid) sandbox iframe'de göstermek için tam HTML
   belgesi üretir. ArtifactPanel (canlı önizleme) ve /a/[id] (yayınlanan sayfa)
   AYNI mantığı kullanır → tutarlı render + tek kaynak. */
export function buildArtifactSrcDoc(type: Artifact["type"], content: string): string {
  if (type === "mermaid") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script><style>body{margin:1.5rem;background:#fff;font-family:system-ui,sans-serif;}</style></head><body><div class="mermaid">${content}</div><script>mermaid.initialize({startOnLoad:true,theme:'default'});<\/script></body></html>`;
  }
  if (type === "svg") {
    return `<!DOCTYPE html><html><head><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111110;}</style></head><body>${content}</body></html>`;
  }
  /* html */
  return content.includes("<html")
    ? content
    : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem;}</style></head><body>${content}</body></html>`;
}

/* İndirme için uzantı + gövde (html'de tam belge, diğerlerinde ham içerik). */
export function artifactDownload(type: Artifact["type"], content: string): { ext: string; body: string } {
  const ext = type === "svg" ? "svg" : type === "mermaid" ? "mmd" : "html";
  const body = type === "html" ? buildArtifactSrcDoc(type, content) : content;
  return { ext, body };
}
