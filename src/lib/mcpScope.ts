import type { McpServer } from "./types";

/** Bir MCP sunucusunun araçlarının verilen model profiline (ModelProfile.id)
    sunulup sunulmayacağını belirler. `allowedModelIds` boş/undefined ise
    sunucu TÜM modellere açıktır (varsayılan) — doluysa yalnız listelenen
    modeller görebilir (bkz. McpGallery.tsx "Modeller" kontrolü). */
export function filterMcpServersForModel(servers: McpServer[], modelId: string): McpServer[] {
  return servers.filter((s) => s.enabled && (!s.allowedModelIds?.length || s.allowedModelIds.includes(modelId)));
}
