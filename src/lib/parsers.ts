import { detectLanguage, type EditorFile } from "./editor";

/* Parses every code-fence with an embedded file path from AI output.
   Supports: ```lang:path  |  ```lang file=path  |  ```lang title="path"
   Dedup'd by path (last wins). */
export function extractAllFileFences(md: string): EditorFile[] {
  const re = /```(\w+)(?::([^\s\n`]+)|[ \t]+(?:file|title)=["']?([^\s"'\n`]+)["']?)/g;
  const map = new Map<string, EditorFile>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const path = (m[2] ?? m[3] ?? "").trim();
    if (!path || (!path.includes("/") && !path.includes("."))) continue;
    const fenceEnd = m.index + m[0].length;
    const nlIdx = md.indexOf("\n", fenceEnd);
    if (nlIdx === -1) continue;
    const closeIdx = md.indexOf("\n```", nlIdx);
    const content = closeIdx === -1 ? md.slice(nlIdx + 1) : md.slice(nlIdx + 1, closeIdx);
    map.set(path, { path, content, language: detectLanguage(path) });
  }
  return Array.from(map.values());
}

export function extractFirstFileFence(md: string): EditorFile | null {
  return extractAllFileFences(md)[0] ?? null;
}
