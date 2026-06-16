/* Tree-sitter WASM dosyalarını node_modules'tan public/tree-sitter'a kopyalar.
   Bu dosyalar repoda tutulmaz (büyük); dev/build öncesi otomatik üretilir.
   Eksik gramer/sürüm sessizce atlanır → özellik zarif şekilde devre dışı kalır. */

import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "tree-sitter");
mkdirSync(outDir, { recursive: true });

/* Bu web/TS projesi için en alakalı diller (büyük gramerler hariç). */
const LANGS = [
  "javascript", "typescript", "tsx", "json",
  "css", "html", "python", "go", "rust", "bash",
];

const copies = [
  ["web-tree-sitter/web-tree-sitter.wasm", "web-tree-sitter.wasm"],
  ...LANGS.map((l) => [
    `tree-sitter-wasms/out/tree-sitter-${l}.wasm`,
    `tree-sitter-${l}.wasm`,
  ]),
];

let ok = 0;
for (const [from, to] of copies) {
  const src = join(root, "node_modules", from);
  if (!existsSync(src)) continue;
  try {
    copyFileSync(src, join(outDir, to));
    ok++;
  } catch {
    /* atla */
  }
}
console.log(`[tree-sitter] ${ok}/${copies.length} wasm kopyalandı → public/tree-sitter`);
