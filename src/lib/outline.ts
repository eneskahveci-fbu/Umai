/* Sözdizimi-farkında kod taslağı (sembol listesi) — web-tree-sitter (WASM).
   Dosyadaki fonksiyon/sınıf/metot/arayüz tanımlarını gerçek bir parser ile
   çıkarır (regex değil). Runtime ve gramerler /public/tree-sitter'dan TEMBEL
   yüklenir; yüklenemezse boş liste döner (özellik zarifçe kapanır). */

import type { Parser as ParserType, Language, Node } from "web-tree-sitter";

export interface OutlineSymbol {
  name: string;
  kind: "function" | "class" | "method" | "interface" | "type" | "enum" | "const";
  line: number; // 1 tabanlı
}

/* Monaco dil kimliği → (gramer dosyası adı). Desteklenmeyen = null. */
function grammarFor(language: string): string | null {
  const map: Record<string, string> = {
    typescript: "typescript", ts: "typescript",
    tsx: "tsx", jsx: "tsx",
    javascript: "javascript", js: "javascript", mjs: "javascript",
    python: "python", py: "python",
    go: "go", rust: "rust", rs: "rust",
    json: "json", css: "css", html: "html",
    bash: "bash", sh: "bash", shell: "bash",
  };
  return map[language] ?? null;
}

let parserInit: Promise<void> | null = null;
const langCache = new Map<string, Language | null>();
let ParserClass: typeof ParserType | null = null;

async function ensureParser(): Promise<typeof ParserType | null> {
  try {
    if (!parserInit) {
      parserInit = (async () => {
        const mod = await import("web-tree-sitter");
        ParserClass = mod.Parser;
        await ParserClass.init({
          locateFile: (path: string) => `/tree-sitter/${path}`,
        });
      })();
    }
    await parserInit;
    return ParserClass;
  } catch {
    return null;
  }
}

async function loadLanguage(grammar: string): Promise<Language | null> {
  if (langCache.has(grammar)) return langCache.get(grammar)!;
  try {
    const Parser = await ensureParser();
    if (!Parser) return null;
    const mod = await import("web-tree-sitter");
    const lang = await mod.Language.load(`/tree-sitter/tree-sitter-${grammar}.wasm`);
    langCache.set(grammar, lang);
    return lang;
  } catch {
    langCache.set(grammar, null);
    return null;
  }
}

/* Tanım düğüm tipi → taslak türü ve isim alanı. */
const NODE_KINDS: Record<string, OutlineSymbol["kind"]> = {
  function_declaration: "function",
  function_definition: "function",
  generator_function_declaration: "function",
  class_declaration: "class",
  class_definition: "class",
  method_definition: "method",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
};

/** Dosyanın sembol taslağını döndürür. Hata/desteklenmeyen dilde boş dizi. */
export async function extractOutline(code: string, language: string): Promise<OutlineSymbol[]> {
  const grammar = grammarFor(language);
  if (!grammar || !code.trim()) return [];
  const Parser = await ensureParser();
  if (!Parser) return [];
  const lang = await loadLanguage(grammar);
  if (!lang) return [];

  let tree;
  try {
    const parser = new Parser();
    parser.setLanguage(lang);
    tree = parser.parse(code);
    if (!tree) return [];
  } catch {
    return [];
  }

  const out: OutlineSymbol[] = [];
  const seen = new Set<string>();

  const nameOf = (node: Node): string | null => {
    const nameNode =
      node.childForFieldName("name") ?? node.childForFieldName("id");
    return nameNode?.text ?? null;
  };

  const visit = (node: Node) => {
    const kind = NODE_KINDS[node.type];
    if (kind) {
      const name = nameOf(node);
      if (name) {
        const line = node.startPosition.row + 1;
        const key = `${line}:${name}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ name, kind, line });
        }
      }
    }
    /* Üst düzey ok-fonksiyon/ifade const'ları (export const x = () => …). */
    if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
      for (const decl of node.namedChildren) {
        if (decl?.type !== "variable_declarator") continue;
        const value = decl.childForFieldName("value");
        if (value && (value.type === "arrow_function" || value.type === "function_expression")) {
          const name = decl.childForFieldName("name")?.text;
          if (name) {
            const line = decl.startPosition.row + 1;
            const key = `${line}:${name}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.push({ name, kind: "function", line });
            }
          }
        }
      }
    }
    for (const child of node.namedChildren) {
      if (child) visit(child);
    }
  };

  try {
    visit(tree.rootNode);
  } catch {
    return out;
  }
  return out.sort((a, b) => a.line - b.line);
}

/** Bu dil için taslak çıkarımı destekleniyor mu? */
export function canOutline(language: string): boolean {
  return grammarFor(language) !== null;
}
