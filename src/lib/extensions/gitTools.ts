// ---------------------------------------------------------------------------
// Git Diff / Log / Blame araç tanımları (OpenAI function-calling formatı)
// GitHub Compare API ve Commits API üzerinden çalışır.
// ---------------------------------------------------------------------------

import type { ToolDefinition } from "@/lib/tools";

export const GIT_TOOLS: ToolDefinition[] = [
  // ── git diff ──────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "git_diff",
      description:
        "İki commit, dal veya tag arasındaki farkı GitHub Compare API üzerinden gösterir. " +
        "Claude Code'daki 'git diff' gibi. Örn: 'main...feature/x' veya 'abc123..def456'. " +
        "GitHub token'ı gerekir, repoya bağlı olunmalı.",
      parameters: {
        type: "object",
        properties: {
          base: {
            type: "string",
            description: "Baz commit/dal/tag. Örn: 'main', 'HEAD~3'",
          },
          head: {
            type: "string",
            description: "Karşılaştırılacak commit/dal/tag. Örn: 'feature/x', 'HEAD'",
          },
        },
        required: ["base", "head"],
      },
    },
  },

  // ── git log ───────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "git_log",
      description:
        "Bağlı reponun commit geçmişini listeler. Claude Code'daki 'git log' gibi. " +
        "Dal, dosya yolu ve sayı filtresi verilebilir.",
      parameters: {
        type: "object",
        properties: {
          branch: {
            type: "string",
            description: "Dal adı. Varsayılan: bağlı dal.",
          },
          path: {
            type: "string",
            description: "Belirli bir dosya/dizin için filtrele (opsiyonel).",
          },
          limit: {
            type: "number",
            description: "Kaç commit gösterilsin? Varsayılan 10, max 30.",
          },
        },
      },
    },
  },

  // ── git blame ─────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "git_blame",
      description:
        "Belirtilen dosyadaki her satırın son değiştirenini ve commit'ini gösterir. " +
        "Claude Code'daki 'git blame' gibi. Satır aralığı verilebilir.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "İncelenecek dosya yolu (repo köküne göre).",
          },
          startLine: {
            type: "number",
            description: "Başlangıç satırı (opsiyonel, 1-tabanlı).",
          },
          endLine: {
            type: "number",
            description: "Bitiş satırı (opsiyonel, dahil).",
          },
        },
        required: ["path"],
      },
    },
  },

  // ── discover_rules (salt-okunur, burada tanımlı) ──────────────────────
  {
    type: "function",
    function: {
      name: "discover_rules",
      description:
        "Bağlı repoda CLAUDE.md, AGENTS.md, .rules, .cursorrules gibi davranış " +
        "dosyalarını otomatik tarar ve içeriklerini döndürür. Kullanıcıdan gizli " +
        "kuralları keşfetmek için kullanılır.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // ── trigger_ci ────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "trigger_ci",
      description:
        "GitHub Actions workflow'unu tetikler (repository_dispatch). CI/CD pipeline'ını " +
        "uzaktan başlatmak için kullanılır. GitHub token'ı ve workflow dosyası gerekir.",
      parameters: {
        type: "object",
        properties: {
          workflow: {
            type: "string",
            description: "Workflow dosya adı veya ID. Örn: 'ci.yml', 'deploy.yml'",
          },
          ref: {
            type: "string",
            description: "Hangi dal/ref üzerinde çalıştırılacak? Varsayılan: bağlı dal.",
          },
          inputs: {
            type: "object",
            description: "Workflow'a geçilecek ek parametreler (anahtar-değer, opsiyonel).",
          },
        },
        required: ["workflow"],
      },
    },
  },
];
