"use client";

import { useEffect, useRef, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";
import {
  Brain,
  Check,
  FolderGit2,
  GitBranch,
  Moon,
  Pencil,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { isGuestMode, setGuestMode, useStore } from "@/lib/store";
import { PRESETS, PROVIDER_MODELS, DEFAULT_SYSTEM_PROMPT, STYLE_LABELS } from "@/lib/constants";
import { calculateCost, formatCost } from "@/lib/pricing";
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
  const setActiveGithub = useStore((s) => s.setActiveGithub);
  const addGitlab = useStore((s) => s.addGitlab);
  const removeGitlab = useStore((s) => s.removeGitlab);
  const setActiveGitlab = useStore((s) => s.setActiveGitlab);
  const addRepo = useStore((s) => s.addRepo);
  const setActiveRepo = useStore((s) => s.setActiveRepo);
  const removeRepo = useStore((s) => s.removeRepo);
  const saveConfig = useStore((s) => s.saveConfig);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const addToast = useStore((s) => s.addToast);
  const chats = useStore((s) => s.chats);
  const addMemory = useStore((s) => s.addMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const updateProject = useStore((s) => s.updateProject);

  const [tab, setTab] = useState<"model" | "github" | "general" | "advanced">("model");
  const [search, setSearch] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, open, () => setOpen(false));
  const [guestMode, setGuestModeState] = useState(() =>
    typeof window === "undefined" ? false : isGuestMode(),
  );

  /* Keyword index — typing in the search box jumps to whichever tab
     contains the matching keyword (first hit wins). */
  const SEARCH_INDEX: Record<"model" | "github" | "general" | "advanced", string[]> = {
    model:    ["model", "api", "anahtar", "key", "openai", "anthropic", "huggingface", "hf", "provider", "test"],
    github:   ["github", "gitlab", "token", "depo", "repo", "branch", "dal", "kullanıcı", "username"],
    general:  ["sistem", "prompt", "stil", "style", "tema", "theme", "renk", "color", "accent", "font", "yazı", "ses", "sound", "skill", "memori", "ayar"],
    advanced: ["webcontainer", "key", "context", "max", "guest", "misafir", "kural", "rules", "rulesfile", "gelişmiş"],
  };
  const matchingTabs = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set<string>();
    const hits = new Set<string>();
    for (const [k, kws] of Object.entries(SEARCH_INDEX)) {
      if (kws.some((kw) => kw.includes(q))) hits.add(k);
    }
    return hits;
  })();
  /* Auto-jump to the first matching tab when search changes */
  useEffect(() => {
    if (!search.trim() || matchingTabs.size === 0) return;
    const first = (["model", "github", "general", "advanced"] as const).find((k) => matchingTabs.has(k));
    if (first && first !== tab) setTab(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
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
  const [glUser, setGlUser] = useState("");
  const [glToken, setGlToken] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [memInput, setMemInput] = useState("");
  /* Sağlayıcıdan anahtarla canlı çekilen model listesi + durum */
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  /* Anahtar girildiğinde modelleri otomatik (debounce'lu) çek. Anahtara göre
     gerçek model listesini getirir; böylece model adı tahminden kaynaklı
     "geçersiz model/anahtar" hataları oluşmaz. */
  useEffect(() => {
    if (!open || tab !== "model") return;
    const key = apiKey.trim();
    const url = baseUrl.trim();
    if (!url || (key.length > 0 && key.length < 8)) return;
    if (provider !== "ollama" && provider !== "custom" && key.length === 0) return;
    const t = setTimeout(() => {
      fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: url, apiKey: key, provider }),
      })
        .then((r) => r.json().catch(() => ({})))
        .then((data) => {
          if (!Array.isArray(data.models)) return;
          const models: string[] = data.models;
          setFetchedModels(models);
          if (models.length && !models.includes(model.trim())) {
            const preferred = (PROVIDER_MODELS[provider] ?? []).find((m) => models.includes(m));
            setModel(preferred || models[0]);
          }
        })
        .catch(() => { /* sessiz; manuel "Yenile" butonu var */ });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, baseUrl, provider, open, tab]);

  if (!open) return null;

  const onProvider = (p: Provider) => {
    setProvider(p);
    setFetchedModels([]);
    if (p !== "custom") { setBaseUrl(PRESETS[p].baseUrl); setModel(PRESETS[p].model); }
  };

  /* Girilen anahtar + Base URL ile sağlayıcının desteklediği gerçek modelleri
     çeker. Model adını tahmin etmek yerine anahtara göre listelediğimizden
     "model bulunamadı / geçersiz" hataları önlenir. */
  const loadModels = async (opts?: { silent?: boolean }) => {
    if (!baseUrl.trim()) { if (!opts?.silent) addToast("Önce Base URL gir.", "error"); return; }
    setLoadingModels(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.models)) {
        if (!opts?.silent) addToast(data.error || "Modeller alınamadı.", "error");
        setFetchedModels([]);
        return;
      }
      const models: string[] = data.models;
      setFetchedModels(models);
      if (models.length) {
        /* Mevcut model bu anahtarla erişilebilir değilse, ilk geçerli modele
           otomatik düzelt; varsa önerilen (PRESET) modeli tercih et. */
        if (!models.includes(model.trim())) {
          const preferred = (PROVIDER_MODELS[provider] ?? []).find((m) => models.includes(m));
          setModel(preferred || models[0]);
        }
        if (!opts?.silent) addToast(`${models.length} model bulundu.`, "success");
      } else if (!opts?.silent) {
        addToast("Bu anahtarla model bulunamadı.", "info");
      }
    } catch (err) {
      if (!opts?.silent) addToast(`Hata: ${(err as Error).message}`, "error");
      setFetchedModels([]);
    } finally {
      setLoadingModels(false);
    }
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

  const submitGitlab = () => {
    if (!glUser.trim() || !glToken.trim()) { addToast("Kullanıcı adı ve token gerekli.", "error"); return; }
    addGitlab({ username: glUser.trim(), token: glToken.trim() });
    addToast("GitLab hesabı eklendi.", "success");
    setGlUser(""); setGlToken("");
  };

  const submitRepo = () => {
    if (!repoInput.trim()) { addToast("Depo adı gerekli.", "error"); return; }
    addRepo(repoInput.trim());
    addToast("Depo eklendi.", "success");
    setRepoInput("");
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
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 max-h-[92dvh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="settings-title" className="text-lg font-bold">Ayarlar</h3>
          <button onClick={() => setOpen(false)} className="text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft"><X size={18} /></button>
        </div>

        <div className="relative mb-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ayar ara — örn. font, github, webcontainer…"
            className="w-full bg-bgsoft/60 border border-line/60 rounded-xl pl-9 pr-8 py-2 text-sm outline-none focus:border-brand/50 placeholder:text-muted/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/40 hover:text-ink p-1 rounded transition-colors"
              title="Temizle"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex gap-1 mb-5 border-b border-line">
          {([["model", "Model"], ["github", "GitHub"], ["general", "Genel"], ["advanced", "Gelişmiş"]] as const).map(([key, lbl]) => {
            const hit = matchingTabs.has(key);
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  tab === key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {lbl}
                {hit && tab !== key && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* MODEL */}
        {tab === "model" && (
          <section>
            <p className="text-xs text-muted mb-3">Birden fazla model ekleyebilirsin. Anahtarlar yalnızca bu tarayıcıda saklanır.</p>
            
            {/* Gemini API Info */}
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="text-xs text-blue-400 font-semibold mb-1">💡 Gemini API Hakkında</div>
              <p className="text-xs text-blue-300 leading-relaxed">
                Google Gemini ücretsiz olarak kullanılabilir. 
                <a href="https://ai.google.dev/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:text-blue-100 underline"> ai.google.dev</a>'den API anahtarı alabilirsin. 
                Günde 1.5 milyon istek sınırı var.
              </p>
            </div>

            {config.models.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {config.models.map((m) => {
                  const active = config.activeModelId === m.id;
                  const ed = editId === m.id;
                  return (
                    <div key={m.id} className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border ${active ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveModel(m.id)} className={`w-5 h-5 rounded-full grid place-items-center border ${active ? "bg-brand border-brand text-white" : "border-muted"}`}>
                          {active && <Check size={11} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          {ed ? <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="input-mono !py-1 text-sm" /> : <><div className="text-sm font-semibold truncate">{m.label}</div><div className="text-xs text-muted font-mono truncate">{m.model}</div></>}
                        </div>
                        <div className="flex items-center gap-1">
                          {ed ? <button onClick={() => { updateModel(editId!, { label: editLabel.trim() || undefined, apiKey: editKey.trim() }); addToast("Güncellendi.", "success"); setEditId(null); }} className="text-muted hover:text-green p-1"><Check size={14} /></button>
                            : <>
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
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={`API anahtarı — ${PRESETS[provider].keyHint}`} className="input-mono" />
                {fetchedModels.length > 0 ? (
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="input-mono">
                    {!fetchedModels.includes(model) && model && <option value={model}>{model}</option>}
                    {fetchedModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <>
                    <input value={model} onChange={(e) => setModel(e.target.value)} list="model-suggestions" placeholder="Model adı — anahtar girince otomatik dolar" className="input-mono" />
                    <datalist id="model-suggestions">
                      {(PROVIDER_MODELS[provider] ?? []).map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => loadModels()}
                  disabled={loadingModels}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line hover:border-brand text-xs font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
                >
                  {loadingModels ? "Modeller yükleniyor…" : fetchedModels.length > 0 ? `↻ Modelleri yenile (${fetchedModels.length})` : "↻ Anahtarla modelleri getir"}
                </button>
                <button onClick={submitModel} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white text-sm font-semibold"><Plus size={15} /> Model Ekle</button>
              </div>
            </div>
          </section>
        )}

        {/* GITHUB + GITLAB */}
        {tab === "github" && (
          <section className="flex flex-col gap-5">
            {/* GitHub Accounts */}
            <div>
              <h4 className="text-sm font-bold mb-1">GitHub Hesapları</h4>
              <p className="text-xs text-muted mb-2">Birden fazla hesap ekleyebilirsin. Aktif hesap token gerektiren işlemlerde kullanılır.</p>
              {config.githubAccounts.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {config.githubAccounts.map((a) => {
                    const isActive = config.activeGithubId === a.id;
                    return (
                      <div key={a.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isActive ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                        <button
                          onClick={() => setActiveGithub(a.id)}
                          className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${isActive ? "bg-brand border-brand text-white" : "border-muted"}`}
                        >
                          {isActive && <Check size={11} />}
                        </button>
                        <GitBranch size={13} className={isActive ? "text-brand" : "text-muted"} />
                        <span className="flex-1 text-sm font-semibold truncate">{a.username}</span>
                        {isActive && <span className="text-[10px] text-brand font-mono">aktif</span>}
                        <button onClick={() => removeGithub(a.id)} className="text-muted hover:text-red p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
                <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">+ Hesap Ekle</div>
                <div className="grid gap-2">
                  <input value={ghUser} onChange={(e) => setGhUser(e.target.value)} placeholder="Kullanıcı adı" className="input-mono" />
                  <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="GitHub token (ghp_...)" className="input-mono" />
                  <button onClick={submitGithub} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"><Plus size={15} /> Hesap Ekle</button>
                </div>
              </div>
            </div>

            {/* Repositories */}
            <div>
              <h4 className="text-sm font-bold mb-1">Depolar</h4>
              <p className="text-xs text-muted mb-2">Aktif depo Coder'da otomatik bağlanır. En fazla 12 depo kaydedilir.</p>
              {config.repos.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {config.repos.map((r) => {
                    const isActive = config.activeRepo === r;
                    return (
                      <div key={r} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isActive ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                        <button
                          onClick={() => setActiveRepo(r)}
                          className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${isActive ? "bg-brand border-brand text-white" : "border-muted"}`}
                        >
                          {isActive && <Check size={11} />}
                        </button>
                        <FolderGit2 size={13} className={isActive ? "text-brand" : "text-muted"} />
                        <span className="flex-1 text-xs font-mono truncate">{r}</span>
                        {isActive && <span className="text-[10px] text-brand font-mono">aktif</span>}
                        <button onClick={() => removeRepo(r)} className="text-muted hover:text-red p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
                <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">+ Depo Ekle</div>
                <div className="grid gap-2">
                  <input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="sahip/depo veya sahip/depo:dal" className="input-mono" onKeyDown={(e) => { if (e.key === "Enter") submitRepo(); }} />
                  <button onClick={submitRepo} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"><Plus size={15} /> Depo Ekle</button>
                </div>
              </div>
            </div>

            {/* GitLab Accounts */}
            <div>
              <h4 className="text-sm font-bold mb-1">GitLab Hesapları</h4>
              <p className="text-xs text-muted mb-2">GitLab personal access token ekle. Aktif hesap GitLab repolarına erişimde kullanılır.</p>
              {(config.gitlabAccounts ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {(config.gitlabAccounts ?? []).map((a) => {
                    const isActive = config.activeGitlabId === a.id;
                    return (
                      <div key={a.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isActive ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                        <button
                          onClick={() => setActiveGitlab(a.id)}
                          className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${isActive ? "bg-brand border-brand text-white" : "border-muted"}`}
                        >
                          {isActive && <Check size={11} />}
                        </button>
                        <GitBranch size={13} className={isActive ? "text-brand" : "text-muted"} />
                        <span className="flex-1 text-sm font-semibold truncate">{a.username}</span>
                        {isActive && <span className="text-[10px] text-brand font-mono">aktif</span>}
                        <button onClick={() => removeGitlab(a.id)} className="text-muted hover:text-red p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
                <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">+ GitLab Hesap Ekle</div>
                <div className="grid gap-2">
                  <input value={glUser} onChange={(e) => setGlUser(e.target.value)} placeholder="Kullanıcı adı" className="input-mono" />
                  <input type="password" value={glToken} onChange={(e) => setGlToken(e.target.value)} placeholder="GitLab token (glpat-...)" className="input-mono" />
                  <button onClick={submitGitlab} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"><Plus size={15} /> Hesap Ekle</button>
                </div>
              </div>
            </div>

            {/* CLI Mode */}
            <div>
              <h4 className="text-sm font-bold mb-2">CLI Modu</h4>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={config.cliMode} onChange={() => saveConfig({ ...config, cliMode: !config.cliMode })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Otomatik bağlantı</div>
                    <div className="text-xs text-muted mt-0.5">Coder sekmesi açılınca aktif depoyu otomatik olarak bağlar.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={config.autoTerminal} onChange={() => saveConfig({ ...config, autoTerminal: !config.autoTerminal })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Terminal'i otomatik aç</div>
                    <div className="text-xs text-muted mt-0.5">Coder sekmesi açılınca terminal panelini otomatik gösterir.</div>
                  </div>
                </label>
              </div>
            </div>

            {/* .rules dosyası */}
            <div>
              <h4 className="text-sm font-bold mb-1">.rules — Proje Kuralları</h4>
              <p className="text-xs text-muted mb-2">
                Coder'da her istekte sistem promptuna eklenir. Teknoloji tercihlerin, kod stili, kısıtlamalar.
              </p>
              <textarea
                value={config.rulesFile}
                onChange={(e) => saveConfig({ ...config, rulesFile: e.target.value })}
                rows={5}
                placeholder={"Örn:\n- TypeScript strict mode kullan\n- Tailwind CSS tercih et\n- Yorum satırı yazma\n- Her fonksiyon max 20 satır"}
                className="input-mono !text-xs leading-relaxed w-full"
              />
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
                <input value={memInput} onChange={(e) => setMemInput(e.target.value)} placeholder="Örn: Python tercih ederim" className="input-mono !py-1.5 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") { if (memInput.trim()) { addMemory(memInput.trim()); setMemInput(""); } } }} />
                <button onClick={() => { if (memInput.trim()) { addMemory(memInput.trim()); setMemInput(""); } }} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold shrink-0">Ekle</button>
              </div>
            </div>

            {/* Proje promptu */}
            {activeProj && (
              <div>
                <h4 className="text-sm font-bold mb-1">Proje Promptu: {activeProj.name}</h4>
                <textarea value={activeProj.systemPrompt} onChange={(e) => updateProject(activeProj.id, { systemPrompt: e.target.value })} rows={3} className="input-mono !text-xs" placeholder="Bu projenin için özel sistem promptu..." />
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

        {/* GELİŞMİŞ */}
        {tab === "advanced" && (
          <section className="flex flex-col gap-5">
            {/* Guest mode */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestMode}
                  onChange={(e) => {
                    setGuestModeState(e.target.checked);
                    setGuestMode(e.target.checked);
                    addToast(
                      e.target.checked
                        ? "Misafir mod açık — anahtarlar sekme kapanınca silinir. Yenile."
                        : "Misafir mod kapalı — yenile.",
                      "info",
                    );
                  }}
                  className="accent-brand mt-0.5"
                />
                <span>
                  <span className="text-sm font-semibold block">Misafir mod</span>
                  <span className="text-xs text-muted/70 leading-relaxed">
                    Açıkken API anahtarları ve GitHub token&apos;ları yalnızca bu sekmede saklanır
                    (sessionStorage), sekme kapanınca silinir. Paylaşılan bilgisayarlarda öner.
                    Değişiklikten sonra sayfayı yenile.
                  </span>
                </span>
              </label>
            </div>

            {/* WebContainer API key */}
            <div>
              <h4 className="text-sm font-bold mb-1">WebContainer API Key</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Gerçek terminal için gerekli. <strong className="text-muted">localhost&apos;ta gerekmez</strong>;
                production domain&apos;de (Vercel vb.){" "}
                <a href="https://webcontainer.io/enterprise" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  webcontainer.io
                </a>
                {" "}üzerinden bireysel/OSS hesaplara ücretsiz verilen key&apos;i buraya yapıştır.
                Key tarayıcında saklanır, sunucuya gönderilmez.
              </p>
              <input
                type="password"
                value={config.webcontainerApiKey}
                onChange={(e) => saveConfig({ ...config, webcontainerApiKey: e.target.value })}
                placeholder="wc_..."
                className="input-mono w-full"
                autoComplete="off"
              />
            </div>

            {/* Yazı tipi boyutu */}
            <div>
              <h4 className="text-sm font-bold mb-2">Kod Yazı Tipi Boyutu</h4>
              <div className="flex gap-2">
                {(["sm", "base", "lg"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      saveConfig({ ...config, fontScale: s });
                      document.documentElement.className = document.documentElement.className
                        .replace(/font-\w+/g, "")
                        .concat(` font-${s}`);
                    }}
                    className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                      config.fontScale === s ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {s === "sm" ? "Küçük" : s === "base" ? "Normal" : "Büyük"}
                  </button>
                ))}
              </div>
            </div>

            {/* Vurgu rengi */}
            <div>
              <h4 className="text-sm font-bold mb-2">Vurgu Rengi</h4>
              <div className="flex gap-2">
                {([
                  { k: "purple", label: "Mor", color: "bg-purple-500" },
                  { k: "blue", label: "Mavi", color: "bg-blue-500" },
                  { k: "green", label: "Yeşil", color: "bg-green-500" },
                  { k: "orange", label: "Turuncu", color: "bg-orange-500" },
                ] as { k: "purple" | "blue" | "green" | "orange"; label: string; color: string }[]).map(({ k, label, color }) => (
                  <button
                    key={k}
                    onClick={() => {
                      saveConfig({ ...config, accentColor: k });
                      const cls = document.documentElement.classList;
                      cls.remove("accent-purple", "accent-blue", "accent-green", "accent-orange");
                      cls.add(`accent-${k}`);
                    }}
                    className={`flex-1 py-2 rounded-lg border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                      config.accentColor === k ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bildirim sesi + Browser bildirimi */}
            <div>
              <h4 className="text-sm font-bold mb-2">Bildirimler</h4>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.soundEnabled}
                    onChange={() => saveConfig({ ...config, soundEnabled: !config.soundEnabled })}
                    className="accent-brand"
                  />
                  <div>
                    <div className="text-sm font-semibold">Ses bildirimi</div>
                    <div className="text-xs text-muted mt-0.5">Yanıt tamamlanınca kısa bir bip sesi çalar.</div>
                  </div>
                </label>
                <button
                  onClick={async () => {
                    if (!("Notification" in window)) { addToast("Bu tarayıcı bildirimleri desteklemiyor.", "error"); return; }
                    const perm = await Notification.requestPermission();
                    if (perm === "granted") addToast("Bildirimler açık — sekme arka plandayken uyarı alacaksın.", "success");
                    else addToast("Bildirim izni verilmedi.", "error");
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 text-sm text-left transition-colors"
                >
                  <span className="text-lg">🔔</span>
                  <div>
                    <div className="text-sm font-semibold">Tarayıcı bildirimi aç</div>
                    <div className="text-xs text-muted mt-0.5">Sekme arka planda iken yanıt hazır olunca bildirim gelir.</div>
                  </div>
                </button>
              </div>
            </div>

            {/* İstatistikler */}
            <div>
              <h4 className="text-sm font-bold mb-2">İstatistikler & Harcama</h4>
              {(() => {
                const totalIn = chats.reduce((n, c) => n + (c.totalInTokens ?? 0), 0);
                const totalOut = chats.reduce((n, c) => n + (c.totalOutTokens ?? 0), 0);
                const activeModel = config.models.find((m) => m.id === config.activeModelId);
                const totalCost = activeModel ? calculateCost(activeModel.model, totalIn, totalOut) : null;
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Toplam Oturum", value: chats.length },
                      { label: "Toplam Mesaj", value: chats.reduce((n, c) => n + c.messages.length, 0) },
                      { label: "Giriş Token", value: totalIn.toLocaleString() },
                      { label: "Çıkış Token", value: totalOut.toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-bgsoft border border-line rounded-xl px-3 py-2.5">
                        <div className="text-xs text-muted">{label}</div>
                        <div className="text-lg font-bold mt-0.5">{value}</div>
                      </div>
                    ))}
                    {totalCost !== null && (
                      <div className="col-span-2 bg-brand/5 border border-brand/20 rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted">Tahmini API Maliyeti</div>
                          <div className="text-xs text-muted/60 mt-0.5">(aktif model · tüm oturumlar)</div>
                        </div>
                        <div className="text-xl font-bold text-brand">{formatCost(totalCost)}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
