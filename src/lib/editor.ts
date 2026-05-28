export interface EditorFile {
  path: string;
  content: string;
  language: string;
}

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  md: "markdown",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sh: "shell",
  sql: "sql",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  xml: "xml",
};

export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_MAP[ext] ?? "plaintext";
}
