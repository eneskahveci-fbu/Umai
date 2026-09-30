import type { McpServer } from "./types";

/** Bir MCP sunucusunun araçlarının verilen model profiline (ModelProfile.id)
    sunulup sunulmayacağını belirler. `allowedModelIds` boş/undefined ise
    sunucu TÜM modellere açıktır (varsayılan) — doluysa yalnız listelenen
    modeller görebilir (bkz. McpGallery.tsx "Modeller" kontrolü). */
export function filterMcpServersForModel(servers: McpServer[], modelId: string): McpServer[] {
  return servers.filter((s) => s.enabled && (!s.allowedModelIds?.length || s.allowedModelIds.includes(modelId)));
}

/** Yerleşik (bu dağıtımın kendi /api/mcp/builtin/*) sunucusu mu. */
export function isBuiltinMcpUrl(url: string | undefined): boolean {
  return !!url && url.startsWith("/api/mcp/builtin/");
}

/** Düz (repo'suz) sohbette MCP araçları sunulsun mu: kullanıcının KENDİ bağladığı
    (yerleşik olmayan, adresi dolu) en az bir sunucu açıksa evet. Yerleşikler
    (Zaman/Adım Adım Düşünme — yeni kullanıcılarda varsayılan açık) tek başına
    tetiklemez; aksi halde her düz mesaja MCP gecikmesi eklenirdi (Eyl 2026). */
export function wantsMcpInChat(scoped: McpServer[]): boolean {
  return scoped.some((s) => s.enabled && !!s.url?.trim() && !isBuiltinMcpUrl(s.url));
}
