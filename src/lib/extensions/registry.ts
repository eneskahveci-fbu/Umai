// ---------------------------------------------------------------------------
// Extension Registry — Craft.Coder genişletilebilirlik merkezi.
// Tüm yeni araçlar ve agent'lar BU dosyada birleştirilir.
// Yeni bir extension eklemek için:
//   1. Kendi dizinde araç/agent tanımını yaz
//   2. Bu dosyaya import + spread ekle
// Mevcut hiçbir dosyaya dokunulmaz.
// ---------------------------------------------------------------------------

import type { ToolDefinition } from "@/lib/tools";
import type { Agent } from "@/lib/agents";
import type { ToolCatalogEntry } from "@/lib/constants";

import { GIT_TOOLS } from "./gitTools";
import { CUSTOM_AGENTS } from "./customAgents";

// ── Araçlar ──────────────────────────────────────────────────────────────
/** LLM'e sunulacak extension araçları (OpenAI function-calling formatında) */
export const EXTENSION_TOOLS: ToolDefinition[] = [
  ...GIT_TOOLS,
];

// ── Agent'lar ─────────────────────────────────────────────────────────────
/** "/" ile tetiklenen extension agent'ları */
export const EXTENSION_AGENTS: Agent[] = [
  ...CUSTOM_AGENTS,
];

// ── Katalog ───────────────────────────────────────────────────────────────
/** SettingsModal → ToolPermissions tablosunda görünecek extension araçları */
export const EXTENSION_CATALOG: ToolCatalogEntry[] = [
  { name: "git_diff",       label: "Git diff (karşılaştır)",  category: "Okuma & Arama", risk: "low" },
  { name: "git_log",        label: "Git log (commit geçmişi)", category: "Okuma & Arama", risk: "low" },
  { name: "git_blame",      label: "Git blame (satır geçmişi)",category: "Okuma & Arama", risk: "low" },
  { name: "discover_rules", label: "CLAUDE.md otomatik keşif", category: "Okuma & Arama", risk: "low" },
  { name: "trigger_ci",     label: "CI/CD tetikle",           category: "Git & PR",       risk: "medium" },
];
