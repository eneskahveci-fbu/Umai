// ---------------------------------------------------------------------------
// Extension Registry — Craft Coder genişletilebilirlik merkezi.
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

// ── Eklenti Paketleri ──────────────────────────────────────────────────────
/* Modüler eklenti sistemi: ilgili araçları "paket" olarak gruplar. Kullanıcı
   Ayarlar → Eklentiler'den tek anahtarla bir paketi açıp kapatır. Açma/kapama,
   paketin araçlarının izinlerini (config.toolPermissions) toplu ayarlar →
   mevcut izin altyapısını yeniden kullanır, yeni durum eklemez. */
export interface ExtensionPack {
  id: string;
  name: string;
  description: string;
  /** Bu paketin sağladığı araç adları (toolPermissions anahtarları). */
  provides: string[];
  /** Eğitsel/öne çıkan paketler için rozet. */
  badge?: string;
}

export const EXTENSION_PACKS: ExtensionPack[] = [
  {
    id: "git-insights",
    name: "Git İçgörüleri",
    description: "Ajan diff/log/blame ile değişiklikleri, commit geçmişini ve satır sahipliğini inceler.",
    provides: ["git_diff", "git_log", "git_blame"],
  },
  {
    id: "rule-discovery",
    name: "Kural Keşfi",
    description: "Depodaki CLAUDE.md / .rules dosyalarını otomatik bulup proje kurallarını uygular.",
    provides: ["discover_rules"],
  },
  {
    id: "cicd",
    name: "CI/CD",
    description: "Sürekli entegrasyon iş akışlarını (GitHub Actions / GitLab CI) tetikler.",
    provides: ["trigger_ci"],
  },
  {
    id: "web-access",
    name: "Web Erişimi",
    description: "Ajan web'de arama yapar ve sayfa içeriğini okur — güncel bilgi ve dokümantasyon için.",
    provides: ["web_search", "read_url"],
  },
];

