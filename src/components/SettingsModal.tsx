"use client";

import { useState } from "react";
import {
  Brain,
  Check,
  Moon,
  Pencil,
  Play,
  Plus,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PRESETS, DEFAULT_SYSTEM_PROMPT, STYLE_LABELS } from "@/lib/constants";
import type { Provider, ResponseStyle } from "@/lib/types";

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const config = useStore((s) => s.config);
  const addModel = useStore((s) => s.addModel);
  const updateModel = useStore((s) => s.updateModel);
  const removeModel = useStore((s) => s.removeModel);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const addGithub = useStore((s) => s.addGithub);
  const removeGithub = useStore((s) => s.removeGithub);
  const saveConfig = useStore((s) => s.saveConfig);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const addToast = useStore((s) => s.addToast);
  const addMemory = useStore((s) => s.addMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const updateProject = useStore((s) => s.updateProject);

  const [tab, setTab] = useState<"model" | "github" | "general">("model");
  const [provider, setProvider] = useState<Provider>("hf");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState(PRESETS.hf.baseUrl);
  const [model, setModel] = useState(PRESETS.hf.model);
  const [apiKey, setApiKey] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editKey, setEditKey] = useState("");
  const [ghUser, setGhUser] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [memInput, setMemInput] = useState("");

  if (!open) return null;

  const onProvider = (p: Provider) => {
    setProvider(p);
    if (p !== "custom") { setBaseUrl(PRESETS[p].baseUrl); setModel(PRESETS[p].model); }
  };

  const submitModel = () => {
    if (!baseUrl.trim() || !model.trim()) { addToast("Base URL ve model gerekli.", "error"); return; }
    addModel({ label: label.trim() || model.trim(), provider, baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
    addToast("Model eklendi.", "success");
    setLabel(""); setApiKey("");
  };

  const submitGithub = () => {
    if (!ghUser.trim() || !ghToken.trim()) { addToast("Kullanıcı adı ve token gerekli.", "error"); return; }
    addGithub({ username: ghUser.trim(), token: ghToken.trim() });
    addToast("GitHub hesabı eklendi.", "success");
    setGhUser(""); setGhToken("");
  };

  const testModel = async (m: { baseUrl: string; model: string; apiKey: string; provider: Provider }) => {
    setTesting(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Merhaba, 1+1=?" }], baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey, provider: m.provider }) });
      addToast(res.ok ? "Bağlantı başarılı!" : `Hata: ${(await res.text()).slice(0, 80)}`, res.ok ? "success" : "error");
    } catch (err) { addToast(`Hata: ${(err as Error).message}`, "error"); }
    finally { setTesting(false); }
  };

  const activeProj = config.projects.find((p) => p.id === config.activeProjectId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Ayarlar</h3>
          <button onClick={() => setOpen(false)} className="text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft"><X size={18} /></button>
        </div>

        <div className="flex gap-1 mb-5 border-b border-line">
          {([["model", "Model"], ["github", "GitHub"], ["general", "Genel"]] as const).map(([key, lbl]) => (
            <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{lbl}</button>
          ))}
        </div>

        {/* MODEL */}
        {tab === "model" && (
          <section>
            <p className="text-xs text-muted mb-3">Birden fazla model ekleyebilirsin. Anahtarlar yalnızca bu tarayıcıda saklanır.</p>
            {config.models.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {config.models.map((m) => {
                  const active = config.activeModelId === m.id;
                  const ed = editId === m.id;
                  return (
                    <div key={m.id} className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border ${active ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveModel(m.id)} className={`w-5 h-5 rounded-full grid place-items-center border ${active ? "bg-brand border-brand text-white" : "border-muted text-transparent"}`}><Check size={12} /></button>
                        <div className="flex-1 min-w-0">
                          {ed ? <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="input-mono !py-1 text-sm" /> : <><div className="text-sm font-semibold truncate">{m.label}</div><div className="text-xs text-muted font-mono truncate">{PRESETS[m.provider]?.label.split(" ")[0]} · {m.model}</div></>}
                        </div>
                        <div className="flex items-center gap-1">
                          {ed ? <button onClick={() => { updateModel(editId!, { label: editLabel.trim() || undefined, apiKey: editKey.trim() }); addToast("Güncellendi.", "success"); setEditId(null); }} className="text-green p-1"><Check size={15} /></button> : <>
                            <button onClick={() => testModel(m)} disabled={testing} className="text-muted hover:text-green p-1 disabled:opacity-40" title="Test et"><Play size={14} /></button>
                            <button onClick={() => { setEditId(m.id); setEditLabel(m.label); setEditKey(m.apiKey); }} className="text-muted hover:text-ink p-1"><Pencil size={14} /></button>
                          </>}
                          <button onClick={() => removeModel(m.id)} className="text-muted hover:text-red p-1"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {ed && <input type="password" value={editKey} onChange={(e) => setEditKey(e.target.value)} className="input-mono !py-1 text-sm" placeholder="API anahtarı" />}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
              <div className="text-xs font-bold text-muted uppercase tracking-wide mb-3">+ Yeni Model Ekle</div>
              <div className="grid gap-2.5">
                <select value={provider} onChange={(e) => onProvider(e.target.value as Provider)} className="input-mono">{(Object.keys(PRESETS) as Provider[]).map((p) => <option key={p} value={p}>{PRESETS[p].label}</option>)}</select>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Görünen ad (opsiyonel)" className="input-mono" />
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL" className="input-mono" />
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model adı" className="input-mono" />
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={`API anahtarı — ${PRESETS[provider].keyHint}`} className="input-mono" />
                <button onClick={submitModel} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white text-sm font-semibold"><Plus size={15} /> Modeli Ekle</button>
              </div>
            </div>
          </section>
        )}

        {/* GITHUB */}
        {tab === "github" && (
          <section>
            <p className="text-xs text-muted mb-3">Coder sekmesinde özel depolara erişmek için token ekle.</p>
            {config.githubAccounts.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {config.githubAccounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-bgsoft">
                    <span className="text-brand">⌥</span>
                    <span className="flex-1 text-sm font-semibold truncate">{a.username}</span>
                    <button onClick={() => removeGithub(a.id)} className="text-muted hover:text-red p-1"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
              <div className="text-xs font-bold text-muted uppercase tracking-wide mb-3">+ GitHub Hesabı Ekle</div>
              <div className="grid gap-2.5">
                <input value={ghUser} onChange={(e) => setGhUser(e.target.value)} placeholder="Kullanıcı adı" className="input-mono" />
                <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="GitHub token (ghp_...)" className="input-mono" />
                <button onClick={submitGithub} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold"><Plus size={15} /> Hesabı Ekle</button>
              </div>
            </div>
          </section>
        )}

        {/* GENEL */}
        {tab === "general" && (
          <section className="flex flex-col gap-5">
            {/* Tema */}
            <div>
              <h4 className="text-sm font-bold mb-2">Tema</h4>
              <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm">
                {config.theme === "dark" ? <><Moon size={15} /> Koyu tema</> : <><Sun size={15} /> Açık tema</>}
                <span className="text-muted ml-auto text-xs">Değiştir</span>
              </button>
            </div>

            {/* Yanıt stili */}
            <div>
              <h4 className="text-sm font-bold mb-2">Yanıt Stili</h4>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.entries(STYLE_LABELS) as [ResponseStyle, typeof STYLE_LABELS.normal][]).map(([k, v]) => (
                  <button key={k} onClick={() => saveConfig({ ...config, style: k })} className={`text-xs px-3 py-2 rounded-lg border ${config.style === k ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>{v.label}</button>
                ))}
              </div>
            </div>

            {/* Bellek */}
            <div>
              <h4 className="text-sm font-bold mb-1">Bellek</h4>
              <p className="text-xs text-muted mb-2">Sohbetler arası hatırlanmasını istediğin bilgileri ekle.</p>
              {config.memories.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {config.memories.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bgsoft border border-line text-xs">
                      <Brain size={12} className="text-brand shrink-0" />
                      <span className="flex-1 truncate">{m.content}</span>
                      <button onClick={() => removeMemory(m.id)} className="text-muted hover:text-red"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={memInput} onChange={(e) => setMemInput(e.target.value)} placeholder="Örn: Python tercih ederim" className="input-mono !py-1.5 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter" && memInput.trim()) { addMemory(memInput.trim()); setMemInput(""); } }} />
                <button onClick={() => { if (memInput.trim()) { addMemory(memInput.trim()); setMemInput(""); } }} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold shrink-0"><Plus size={12} /></button>
              </div>
            </div>

            {/* Proje promptu */}
            {activeProj && (
              <div>
                <h4 className="text-sm font-bold mb-1">Proje Promptu: {activeProj.name}</h4>
                <textarea value={activeProj.systemPrompt} onChange={(e) => updateProject(activeProj.id, { systemPrompt: e.target.value })} rows={3} className="input-mono !text-xs" placeholder="Bu projeye özel talimatlar..." />
              </div>
            )}

            {/* Sistem promptu */}
            <div>
              <h4 className="text-sm font-bold mb-1">Sistem Promptu</h4>
              <textarea value={config.systemPrompt} onChange={(e) => saveConfig({ ...config, systemPrompt: e.target.value })} rows={4} className="input-mono !text-xs leading-relaxed" />
              <button onClick={() => saveConfig({ ...config, systemPrompt: DEFAULT_SYSTEM_PROMPT })} className="text-xs text-muted hover:text-brand mt-1">Varsayılana sıfırla</button>
            </div>

            {/* Togglelar */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input type="checkbox" checked={config.followUps} onChange={() => saveConfig({ ...config, followUps: !config.followUps })} className="accent-brand" />
                Takip soruları öner
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input type="checkbox" checked={config.webSearch} onChange={() => saveConfig({ ...config, webSearch: !config.webSearch })} className="accent-brand" />
                Web arama (varsayılan açık)
              </label>
            </div>

            {/* Bağlam limiti */}
            <div>
              <h4 className="text-sm font-bold mb-2">Bağlam Penceresi</h4>
              <select value={config.maxContext} onChange={(e) => saveConfig({ ...config, maxContext: Number(e.target.value) })} className="input-mono text-xs">
                {[4096, 8192, 16384, 32768, 65536, 131072, 200000].map((n) => (
                  <option key={n} value={n}>{(n / 1024).toFixed(0)}K token</option>
                ))}
              </select>
            </div>

            {/* Kısayollar */}
            <div>
              <h4 className="text-sm font-bold mb-2">Klavye Kısayolları</h4>
              <div className="grid gap-1.5 text-xs">
                {[["Ctrl + N", "Yeni sohbet"], ["Ctrl + Shift + N", "Gizli sohbet"], ["Ctrl + ,", "Ayarlar"]].map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-3">
                    <kbd className="px-2 py-0.5 rounded bg-bgsoft border border-line font-mono text-[11px] text-muted">{key}</kbd>
                    <span className="text-muted">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
