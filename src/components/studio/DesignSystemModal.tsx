"use client";

import { useState } from "react";
import { parseDesignMd } from "@/lib/odFormat";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { allDesignSystems, bundledDesignSystems } from "@/lib/designSystems";
import type { DesignSystem } from "@/lib/types";

/* Tasarım sistemi tarayıcısı — bundled + özel marka sözleşmeleri. Göz at, seç,
   görüntüle; kendi sistemini ekle/sil (config.customDesignSystems'a kaydedilir). */
export function DesignSystemModal({
  activeId,
  onSelect,
  onClose,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);
  const systems = allDesignSystems(config);
  const [detailId, setDetailId] = useState<string>(activeId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Özel", accent: "#c8a87e", designMd: "", tokensCss: "" });
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  /* Open Design DESIGN.md içe aktarma: URL'den (güvenli proxy) çek, ayrıştır,
     formu doldur — kullanıcı gözden geçirip kaydeder. 150+ hazır sistemle
     (github.com/nexu-io/open-design/design-systems) doğrudan uyumlu. */
  const importFromUrl = async () => {
    const u = importUrl.trim();
    if (!/^https?:\/\//i.test(u)) { addToast("Geçerli bir DESIGN.md URL'si gir (Raw link).", "error"); return; }
    setImporting(true);
    try {
      const res = await fetch(`/api/fetch-text?url=${encodeURIComponent(u)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.text !== "string") throw new Error(data.error || `HTTP ${res.status}`);
      const parsed = parseDesignMd(data.text);
      setForm({ name: parsed.name, category: parsed.category, accent: parsed.accent, designMd: parsed.designMd, tokensCss: "" });
      addToast(`"${parsed.name}" ayrıştırıldı — gözden geçirip kaydet.`, "success");
    } catch (e) {
      addToast(`İçe aktarılamadı: ${(e as Error).message}`, "error");
    } finally { setImporting(false); }
  };

  const detail = systems.find((s) => s.id === detailId) ?? systems[0];
  const isCustom = (id: string) => !bundledDesignSystems.some((b) => b.id === id);

  const saveCustom = () => {
    const name = form.name.trim();
    if (!name || !form.designMd.trim()) { addToast("İsim ve tasarım sözleşmesi (DESIGN) gerekli.", "error"); return; }
    const id = `custom_${Date.now().toString(36)}`;
    const sys: DesignSystem = {
      id, name, category: form.category.trim() || "Özel", accent: form.accent,
      designMd: form.designMd.trim(),
      tokensCss: form.tokensCss.trim() || `:root{--brand:${form.accent};--accent:${form.accent}}`,
    };
    saveConfig({ ...config, customDesignSystems: [...(config.customDesignSystems ?? []), sys] });
    setCreating(false); setForm({ name: "", category: "Özel", accent: "#c8a87e", designMd: "", tokensCss: "" });
    setDetailId(id);
    addToast("Özel tasarım sistemi eklendi.", "success");
  };

  const removeCustom = (id: string) => {
    saveConfig({ ...config, customDesignSystems: (config.customDesignSystems ?? []).filter((s) => s.id !== id) });
    if (detailId === id) setDetailId("craft");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 grid place-items-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
          <h2 className="text-sm font-bold">Tasarım Sistemleri</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating((v) => !v)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-ink"><Plus size={13} /> Özel sistem</button>
            <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Grid */}
          <div className="w-1/2 sm:w-56 shrink-0 border-r border-line overflow-auto p-2 space-y-1">
            {systems.map((s) => (
              <button
                key={s.id}
                onClick={() => setDetailId(s.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${detailId === s.id ? "bg-brand/10 text-brand" : "text-ink hover:bg-bgsoft"}`}
              >
                <span className="w-4 h-4 rounded-full border border-line/50 shrink-0" style={{ background: s.accent }} />
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
                {activeId === s.id && <Check size={13} className="text-brand shrink-0" />}
                {isCustom(s.id) && (
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeCustom(s.id); }} className="text-muted/50 hover:text-red shrink-0"><Trash2 size={12} /></span>
                )}
              </button>
            ))}
          </div>

          {/* Detay / oluştur */}
          <div className="flex-1 min-w-0 overflow-auto p-4">
            {creating ? (
              <div className="space-y-3 max-w-lg">
                <h3 className="text-sm font-bold">Özel tasarım sistemi</h3>
                {/* Open Design DESIGN.md içe aktarma */}
                <div className="flex gap-1.5">
                  <input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void importFromUrl(); }}
                    placeholder="Open Design DESIGN.md URL'si (Raw) — otomatik doldurur"
                    className="input-mono !py-1.5 text-xs flex-1"
                  />
                  <button onClick={() => void importFromUrl()} disabled={importing} className="text-xs px-2.5 py-1.5 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-50 shrink-0">
                    {importing ? "…" : "İçe aktar"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad (ör. Marka X)" className="input-mono !py-1.5 text-xs" />
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Kategori" className="input-mono !py-1.5 text-xs" />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">Vurgu rengi
                  <input type="color" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} className="w-8 h-8 rounded border border-line bg-transparent cursor-pointer" />
                </label>
                <textarea value={form.designMd} onChange={(e) => setForm({ ...form, designMd: e.target.value })} rows={5} placeholder="Tasarım sözleşmesi (DESIGN): palet, tipografi, boşluk, köşeler, ton…" className="input-mono !text-xs w-full" />
                <textarea value={form.tokensCss} onChange={(e) => setForm({ ...form, tokensCss: e.target.value })} rows={2} placeholder=":root{--brand:#...;--bg:#...} (opsiyonel)" className="input-mono !text-xs w-full" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 rounded-lg text-muted hover:text-ink">İptal</button>
                  <button onClick={saveCustom} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold">Kaydet</button>
                </div>
              </div>
            ) : detail ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border border-line/50" style={{ background: detail.accent }} />
                  <div>
                    <h3 className="text-base font-bold leading-none">{detail.name}</h3>
                    <span className="text-[11px] text-muted">{detail.category}</span>
                  </div>
                  <button onClick={() => onSelect(detail.id)} className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim">Bu sistemi kullan</button>
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted/70 mb-1">Tasarım sözleşmesi</h4>
                  <p className="text-xs text-ink/85 leading-relaxed whitespace-pre-wrap">{detail.designMd}</p>
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted/70 mb-1">Token’lar</h4>
                  <pre className="text-[10px] font-mono bg-bgsoft border border-line rounded-lg p-2 overflow-auto text-muted whitespace-pre-wrap">{detail.tokensCss}</pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
