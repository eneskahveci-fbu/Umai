"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, Play, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { MCP_CATALOG } from "@/lib/mcpCatalog";
import type { McpServer } from "@/lib/types";

/* Uygulama Bağlantıları galerisi — ExtensionsSettings.tsx (Ayarlar → Eklentiler)
   VE ExtensionStoreModal.tsx (Sidebar → Eklentiler, Settings'i açmadan hızlı
   erişim) arasında PAYLAŞILAN tek gerçek: iki farklı yüzey aynı veriyi
   (config.mcpServers) okur/yazar, mantık burada tek yerde yaşar.

   Kart üzerindeki aç/kapat anahtarı, o kartın McpCatalogEntry.id'sini
   McpServer.catalogId ile eşleştirerek durumu okur/yazar:
   - Aç: eşleşen bir sunucu YOKSA boş URL'li yeni bir sunucu oluşturur
     (kullanıcı hemen altındaki listede URL'i doldurur); VARSA yalnızca
     enabled:true yapar (URL korunur).
   - Kapat: eşleşen sunucuyu SİLMEZ, yalnızca enabled:false yapar — tekrar
     açılınca URL kaybolmaz.
   Bu yüzden "Bağlı Sunucular" listesindeki URL alanı artık DÜZENLENEBİLİR
   (öncesinde salt-okunurdu) — aksi halde kart-aç akışından oluşan boş-URL'li
   girdiyi doldurmanın hiçbir yolu olmazdı. */
export function McpGallery() {
  const config = useStore((s) => s.config);
  const addToast = useStore((s) => s.addToast);
  const addMcpServer = useStore((s) => s.addMcpServer);
  const removeMcpServer = useStore((s) => s.removeMcpServer);
  const updateMcpServer = useStore((s) => s.updateMcpServer);

  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpHeaderKey, setMcpHeaderKey] = useState("");
  const [mcpHeaderVal, setMcpHeaderVal] = useState("");
  const [mcpTesting, setMcpTesting] = useState<string | null>(null);
  const [scopeOpenId, setScopeOpenId] = useState<string | null>(null);

  const servers = config.mcpServers ?? [];
  const models = config.models ?? [];

  const toggleCatalogEntry = (entryId: string, entryName: string) => {
    const existing = servers.find((s) => s.catalogId === entryId);
    if (existing) {
      updateMcpServer(existing.id, { enabled: !existing.enabled });
      addToast(existing.enabled ? `${entryName} kapatıldı` : `${entryName} açıldı`, "info");
      return;
    }
    addMcpServer({ name: entryName, url: "", enabled: true, catalogId: entryId });
    addToast(`${entryName} açıldı — aşağıda sunucu adresini gir.`, "success");
  };

  const submitMcpServer = () => {
    if (!mcpName.trim() || !mcpUrl.trim()) { addToast("Ad ve URL zorunlu.", "error"); return; }
    const headers: Record<string, string> = {};
    if (mcpHeaderKey.trim()) headers[mcpHeaderKey.trim()] = mcpHeaderVal.trim();
    addMcpServer({ name: mcpName.trim(), url: mcpUrl.trim(), headers: Object.keys(headers).length ? headers : undefined, enabled: true });
    setMcpName(""); setMcpUrl(""); setMcpHeaderKey(""); setMcpHeaderVal("");
    addToast("Sunucu eklendi.", "success");
  };

  const testMcpServer = async (id: string, url: string, headers?: Record<string, string>) => {
    setMcpTesting(id);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", server: { url, headers } }),
      });
      const data = await res.json() as { tools?: { name: string }[]; error?: string };
      if (data.tools) addToast(`${data.tools.length} araç bulundu`, "success");
      else addToast(data.error ?? "Bağlanamadı", "error");
    } catch { addToast("Bağlantı hatası", "error"); }
    finally { setMcpTesting(null); }
  };

  const toggleModelAllowed = (srv: McpServer, modelId: string) => {
    const current = srv.allowedModelIds ?? [];
    const next = current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId];
    updateMcpServer(srv.id, { allowedModelIds: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted/70 leading-relaxed">
          Notion, Slack, Obsidian gibi bir sürü uygulamayı MCP (Model Context Protocol) üzerinden bağla —
          AI, bağlı uygulamaların araçlarını sohbet sırasında otomatik kullanabilir. Kart üzerindeki anahtar
          bağlantıyı açar/kapatır; her uygulamanın kendi MCP sunucu adresi (ve varsa kimlik anahtarı) gerekir,
          bunu aşağıdaki listede girersin.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {MCP_CATALOG.map((e) => {
          const linked = servers.find((s) => s.catalogId === e.id);
          const on = !!linked?.enabled;
          return (
            <div
              key={e.id}
              className="relative rounded-xl border border-line/70 bg-surface p-3 flex flex-col gap-1.5"
            >
              <button
                role="switch"
                aria-checked={on}
                aria-label={`${e.name} ${on ? "açık" : "kapalı"}`}
                onClick={() => toggleCatalogEntry(e.id, e.name)}
                className={`absolute top-2 right-2 w-8 h-[18px] rounded-full relative transition-colors ${on ? "bg-brand" : "bg-line"}`}
                title={on ? "Kapat" : "Aç"}
              >
                <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white grid place-items-center transition-all ${on ? "left-[17px]" : "left-0.5"}`}>
                  {on && <Check size={9} className="text-brand" />}
                </span>
              </button>
              <span className="text-lg leading-none">{e.icon}</span>
              <span className="text-[12.5px] font-semibold text-ink pr-8">{e.name}</span>
              <span className="text-[10.5px] text-muted/60 leading-snug">{e.description}</span>
            </div>
          );
        })}
      </div>

      {servers.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted">Bağlı Sunucular</div>
          {servers.map((srv) => {
            const scopeOpen = scopeOpenId === srv.id;
            const restricted = (srv.allowedModelIds?.length ?? 0) > 0;
            return (
              <div key={srv.id} className="rounded-xl border border-line bg-bgsoft overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-semibold truncate">{srv.name}</div>
                    <input
                      value={srv.url}
                      onChange={(e) => updateMcpServer(srv.id, { url: e.target.value })}
                      placeholder="URL (örn. https://mcp.example.com)"
                      className="input-mono w-full text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={srv.enabled}
                      onChange={() => updateMcpServer(srv.id, { enabled: !srv.enabled })}
                      className="accent-brand"
                    />
                    Aktif
                  </label>
                  <button
                    onClick={() => testMcpServer(srv.id, srv.url, srv.headers)}
                    disabled={mcpTesting === srv.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-brand hover:border-brand transition-colors disabled:opacity-50 shrink-0"
                  >
                    {mcpTesting === srv.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  </button>
                  <button onClick={() => removeMcpServer(srv.id)} className="text-muted hover:text-red/80 transition-colors shrink-0" aria-label="Sunucuyu sil">
                    <Trash2 size={14} />
                  </button>
                </div>

                {models.length > 0 && (
                  <div className="border-t border-line/60 px-3 py-2">
                    <button
                      onClick={() => setScopeOpenId(scopeOpen ? null : srv.id)}
                      className="w-full flex items-center justify-between text-[11px] text-muted hover:text-ink transition-colors"
                    >
                      <span>Modeller: {restricted ? `${srv.allowedModelIds!.length} model` : "Tümü"}</span>
                      <ChevronDown size={12} className={`transition-transform ${scopeOpen ? "rotate-180" : ""}`} />
                    </button>
                    {scopeOpen && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10.5px] text-muted/50">
                          Hiçbiri işaretli değilken bu eklenti TÜM modellere açıktır. Belirli modeller işaretlersen yalnızca onlar erişebilir.
                        </p>
                        {models.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-[11.5px] text-ink/85 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={srv.allowedModelIds?.includes(m.id) ?? false}
                              onChange={() => toggleModelAllowed(srv, m.id)}
                              className="accent-brand"
                            />
                            {m.label || m.model}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2 border border-line/60 rounded-xl p-3 bg-bgsoft/40">
        <div className="text-xs font-semibold text-muted mb-2">Yeni Sunucu Ekle</div>
        <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="Sunucu adı (örn. Notion)" className="input-mono w-full" />
        <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="URL (örn. https://mcp.example.com)" className="input-mono w-full" />
        <div className="flex gap-2">
          <input value={mcpHeaderKey} onChange={(e) => setMcpHeaderKey(e.target.value)} placeholder="Header adı (opsiyonel)" className="input-mono flex-1" />
          <input value={mcpHeaderVal} onChange={(e) => setMcpHeaderVal(e.target.value)} placeholder="Değer" className="input-mono flex-1" />
        </div>
        <button
          onClick={submitMcpServer}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand text-[#111110] text-sm font-semibold hover:bg-branddim transition-colors"
        >
          Ekle
        </button>
      </div>

      <p className="text-[11px] text-muted/45 leading-relaxed">
        Aktif sunucuların araçları, araç kullanımı açıkken ilgili modelin sohbetinde AI&apos;a sunulur.
      </p>
    </div>
  );
}
