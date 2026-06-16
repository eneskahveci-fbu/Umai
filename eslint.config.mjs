import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bağımsız Node (CommonJS) PTY terminal servisi — Next.js app kaynağı değil,
    // kendi çalışma zamanı/konvansiyonları var (require vb.).
    "terminal-server/**",
    // Bağımsız Node (CommonJS) Yerel Köprü — gerçek FS/shell/MCP, app kaynağı değil.
    "local-bridge/**",
    // Bağımsız Node (ESM) Başsız SDK + CLI — app kaynağı değil, kendi çalışma
    // zamanı (Node fetch/stdin, JSDoc tipleri) var.
    "sdk/**",
  ]),
]);

export default eslintConfig;
