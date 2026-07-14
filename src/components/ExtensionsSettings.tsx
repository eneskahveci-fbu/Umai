"use client";

import { useRef, useState } from "react";
import { Blocks, Check, Loader2, Play, Plug, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { EXTENSION_PACKS } from "@/lib/extensions/registry";
import { MCP_CATALOG } from "@/lib/mcpCatalog";

/* Eklentiler — iki bölüm:
   1) Uygulama bağlantıları (Tem 2026 kullanıcı kararı, "ChatGPT gibi eklenti
      bağlama"): küratörlü bir galeri (MCP_CATALOG) + genel MCP sunucu
      yönetimi (eskiden admin-only ayrı bir "MCP" sekmesindeydi — SettingsModal
      buradan TAŞINDI, herkese açık). Galeri kartına tıklamak yalnızca "Yeni
      Sunucu Ekle" formunun ad alanını doldurur — gerçek bir servis-özel OAuth
      YOKTUR, kullanıcı o servisin kendi MCP sunucu adresini+kimliğini girer.
   2) Dahili araç paketleri — modüler yetenek paketleri (git-insights, kural
      keşfi, CI/CD, web erişimi); tek anahtarla config.toolPermissions'ı
      toplu ayarlar (mevcut altyapı, değişmedi). */
export function ExtensionsSettings() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);
  const addMcpServer = useStore((s) => s.addMcpServer);
  const removeMcpServer = useStore((s) => s.removeMcpServer);
  const updateMcpServer = useStore((s) => s.updateMcpServer);

  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpHeaderKey, setMcpHeaderKey] = useState("");
  const [mcpHeaderVal, setMcpHeaderVal] = useState("");
  const [mcpTesting, setMcpTesting] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const perms = config.toolPermissions ?? {};
  const isOn = (provides: string[]) => provides.every((n) => perms[n] !== false);

  const toggle = (provides: string[], on: boolean) => {
    const next: Record<string, boolean> = { ...perms };
    for (const n of provides) {
      if (on) delete next[n]; // varsayılan: izinli
      else next[n] = false;
    }
    saveConfig({ ...config, toolPermissions: next });
  };

  const pickCatalogEntry = (name: string) => {
    setMcpName(name);
    nameInputRef.current?.focus();
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

  return (
    <section className="space-y-8">
      {/* ── Uygulama bağlantıları ── */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold flex items-center gap-2"><Plug size={16} className="text-brand" /> Uygulama Bağlantıları</h4>
          <p className="text-xs text-muted/70 mt-1 leading-relaxed">
            Notion, Slack, Google Drive gibi uygulamaları MCP (Model Context Protocol) üzerinden bağla —
            AI, bağlı uygulamaların araçlarını sohbet sırasında otomatik kullanabilir. Her uygulamanın
            kendi MCP sunucu adresi (ve varsa kimlik anahtarı) gerekir; aşağıdaki kartlar yalnızca hızlı
            başlangıç için ad alanını doldurur.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MCP_CATALOG.map((e) => (
            <button
              key={e.id}
              onClick={() => pickCatalogEntry(e.name)}
              className="text-left rounded-xl border border-line/70 bg-surface hover:border-brand/40 hover:bg-bgsoft/40 transition-colors p-3 flex flex-col gap-1.5"
            >
              <span className="text-lg leading-none">{e.icon}</span>
              <span className="text-[12.5px] font-semibold text-ink">{e.name}</span>
              <span className="text-[10.5px] text-muted/60 leading-snug">{e.description}</span>
            </button>
          ))}
        </div>

        {(config.mcpServers ?? []).length > 0 && (
          <div className="flex flex-col gap-2">
            {(config.mcpServers ?? []).map((srv) => (
              <div key={srv.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-bgsoft">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{srv.name}</div>
                  <div className="text-xs text-muted font-mono truncate">{srv.url}</div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
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
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-brand hover:border-brand transition-colors disabled:opacity-50"
                >
                  {mcpTesting === srv.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                </button>
                <button onClick={() => removeMcpServer(srv.id)} className="text-muted hover:text-red/80 transition-colors" aria-label="Sunucuyu sil">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border border-line/60 rounded-xl p-3 bg-bgsoft/40">
          <div className="text-xs font-semibold text-muted mb-2">Yeni Sunucu Ekle</div>
          <input ref={nameInputRef} value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="Sunucu adı (örn. Notion)" className="input-mono w-full" />
          <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="URL (örn. https://mcp.example.com)" className="input-mono w-full" />
          <div className="flex gap-2">
            <input value={mcpHeaderKey} onChange={(e) => setMcpHeaderKey(e.target.value)} placeholder="Header adı (opsiyonel)" className="input-mono flex-1" />
            <input value={mcpHeaderVal} onChange={(e) => setMcpHeaderVal(e.target.value)} placeholder="Değer" className="input-mono flex-1" />
          </div>
          <button
            onClick={submitMcpServer}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand text-[#111110] text-sm font-semibold hover:bg-branddim transition-colors"
          >
            <Plus size={14} /> Ekle
          </button>
        </div>

        <p className="text-[11px] text-muted/45 leading-relaxed">
          Aktif sunucuların araçları, araç kullanımı açıkken her sohbette AI&apos;a sunulur.
        </p>
      </div>

      {/* ── Dahili araç paketleri ── */}
      <div className="space-y-4 pt-2 border-t border-line/40">
        <div>
          <h4 className="text-sm font-bold flex items-center gap-2"><Blocks size={16} className="text-brand" /> Dahili Araç Paketleri</h4>
          <p className="text-xs text-muted/70 mt-1 leading-relaxed">
            Modüler yetenek paketleri. Her paketi tek anahtarla açıp kapatabilirsin; açık paketlerin araçları ajana sunulur.
          </p>
        </div>

        <div className="space-y-2.5">
          {EXTENSION_PACKS.map((pack) => {
            const on = isOn(pack.provides);
            return (
              <div key={pack.id} className="premium-card rounded-xl p-3.5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{pack.name}</span>
                    {pack.badge && <span className="text-[10px] font-bold text-brand bg-brand/12 border border-brand/20 px-1.5 py-0.5 rounded">{pack.badge}</span>}
                  </div>
                  <p className="text-[11px] text-muted/60 mt-0.5 leading-relaxed">{pack.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {pack.provides.map((n) => (
                      <span key={n} className="text-[10px] font-mono text-muted/45 bg-bgsoft border border-line/50 px-1.5 py-0.5 rounded">{n}</span>
                    ))}
                  </div>
                </div>
                {/* Anahtar */}
                <button
                  role="switch"
                  aria-checked={on}
                  onClick={() => { toggle(pack.provides, !on); addToast(on ? `${pack.name} kapatıldı` : `${pack.name} açıldı`, "info"); }}
                  className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${on ? "bg-brand" : "bg-line"}`}
                  title={on ? "Kapat" : "Aç"}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white grid place-items-center transition-all ${on ? "left-[22px]" : "left-0.5"}`}>
                    {on && <Check size={12} className="text-brand" />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted/45 leading-relaxed">
          Not: Eklenti araçları yalnızca bir depo bağlıyken veya Yerel Mod sırasında, ajan çalışırken devreye girer.
        </p>
      </div>
    </section>
  );
}
