"use client";

import { useEffect, useRef, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";
import {
  Brain,
  Check,
  ExternalLink,
  Download,
  FolderGit2,
  GitBranch,
  Loader2,
  Upload,
  Moon,
  Pencil,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { isGuestMode, setGuestMode, useStore } from "@/lib/store";
import { PRESETS, PROVIDER_MODELS, DEFAULT_SYSTEM_PROMPT, STYLE_LABELS, ALL_TOOL_CATALOG } from "@/lib/constants";
import { calculateCost, formatCost } from "@/lib/pricing";
import { fetchUserRepos } from "@/lib/github";
import { fetchGitLabUserRepos } from "@/lib/gitlab";
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
  const addMcpServer = useStore((s) => s.addMcpServer);
  const removeMcpServer = useStore((s) => s.removeMcpServer);
  const updateMcpServer = useStore((s) => s.updateMcpServer);
  const addHook = useStore((s) => s.addHook);
  const removeHook = useStore((s) => s.removeHook);
  const updateHook = useStore((s) => s.updateHook);

  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpHeaderKey, setMcpHeaderKey] = useState("");
  const [mcpHeaderVal, setMcpHeaderVal] = useState("");
  const [mcpTesting, setMcpTesting] = useState<string | null>(null);

  const [hookLabel, setHookLabel] = useState("");
  const [hookCommand, setHookCommand] = useState("");
  const [hookEvent, setHookEvent] = useState<"afterEdit" | "onFinish" | "onError">("afterEdit");

  const [tab, setTab] = useState<"model" | "github" | "general" | "advanced" | "mcp" | "hooks">("model");
  const [search, setSearch] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, open, () => setOpen(false));
  const [guestMode, setGuestModeState] = useState(() =>
    typeof window === "undefined" ? false : isGuestMode(),
  );

  /* Keyword index — typing in the search box jumps to whichever tab
     contains the matching keyword (first hit wins). */
  const SEARCH_INDEX: Record<"model" | "github" | "general" | "advanced" | "mcp" | "hooks", string[]> = {
    model:    ["model", "api", "anahtar", "key", "openai", "anthropic", "huggingface", "hf", "provider", "test"],
    github:   ["github", "gitlab", "token", "depo", "repo", "branch", "dal", "kullanıcı", "username"],
    general:  ["sistem", "prompt", "stil", "style", "tema", "theme", "renk", "color", "accent", "font", "yazı", "ses", "sound", "skill", "memori", "ayar"],
    advanced: ["webcontainer", "key", "context", "max", "guest", "misafir", "kural", "rules", "rulesfile", "gelişmiş"],
    mcp:      ["mcp", "model context", "protocol", "sunucu", "server", "araç", "tool", "entegrasyon"],
    hooks:    ["hook", "kanca", "olay", "event", "lint", "test", "otomatik", "afteredit", "onfinish", "komut", "command"],
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
  /* Auto-jump to the first matching tab when the search text changes —
     adjusted during render rather than in a state-syncing effect. */
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    if (search.trim() && matchingTabs.size > 0) {
      const first = (["model", "github", "general", "advanced", "mcp", "hooks"] as const).find((k) => matchingTabs.has(k));
      if (first && first !== tab) setTab(first);
    }
  }
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
  const [verifyingGithub, setVerifyingGithub] = useState(false);
  const [glUser, setGlUser] = useState("");
  const [glToken, setGlToken] = useState("");
  const [repoInput, setRepoInput] = useState("");
  /* Hesaba bağlı otomatik gelen depolar (henüz eklenmemiş olanlar) */
  const [accountRepos, setAccountRepos] = useState<string[]>([]);
  const [loadingAccountRepos, setLoadingAccountRepos] = useState(false);
  const [testing, setTesting] = useState(false);
  /* Hızlı kurulum: herhangi bir sağlayıcı için anahtar ekle + test et */
  const [quickProvider, setQuickProvider] = useState<Provider>("gemini");
  const [quickKey, setQuickKey] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickResult, setQuickResult] = useState<null | "ok" | string>(null);
  const [memInput, setMemInput] = useState("");
  /* Local drafts for large text fields — saved on blur to avoid calling
     saveConfig on every keystroke (which triggers re-renders and focus loss). */
  const [systemPromptDraft, setSystemPromptDraft] = useState(() => config.systemPrompt);
  const [rulesFileDraft, setRulesFileDraft] = useState(() => config.rulesFile);
  /* Refresh the drafts when the modal (re)opens so stale text isn't shown —
     adjusted during render on the open→true transition. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSystemPromptDraft(config.systemPrompt);
      setRulesFileDraft(config.rulesFile);
    }
  }
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
    if (provider !== "ollama" && provider !== "custom" && provider !== "pollinations" && key.length === 0) return;
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

  /* Git sekmesi açıldığında ve bir hesap aktifse, o hesaptaki depoları otomatik
     getir. Henüz eklenmemiş olanlar "Hesabındaki depolar" listesinde tek tıkla
     eklenebilir. Token varsa özel depolar da gelir. */
  useEffect(() => {
    if (!open || tab !== "github") return;
    const gh = config.githubAccounts.find((a) => a.id === config.activeGithubId);
    const gl = (config.gitlabAccounts ?? []).find((a) => a.id === config.activeGitlabId);
    let cancelled = false;
    (async () => {
      if (!gh && !gl) { if (!cancelled) setAccountRepos([]); return; }
      setLoadingAccountRepos(true);
      const results: string[] = [];
      try {
        if (gh) results.push(...(await fetchUserRepos(gh.token, gh.username)));
      } catch { /* sessiz */ }
      try {
        if (gl) results.push(...(await fetchGitLabUserRepos(gl.token, gl.username)));
      } catch { /* sessiz */ }
      if (cancelled) return;
      const have = new Set(config.repos);
      setAccountRepos([...new Set(results)].filter((r) => !have.has(r)));
      setLoadingAccountRepos(false);
    })();
    return () => { cancelled = true; };
  }, [open, tab, config.activeGithubId, config.activeGitlabId, config.githubAccounts, config.gitlabAccounts, config.repos]);

  if (!open) return null;

  const onProvider = (p: Provider) => {
    setProvider(p);
    setFetchedModels([]);
    if (p !== "custom") { setBaseUrl(PRESETS[p].baseUrl); setModel(PRESETS[p].model); }
    /* Sağlayıcı için daha önce kaydedilmiş anahtar varsa otomatik doldur →
       aynı sağlayıcıya tekrar anahtar girmeye gerek kalmaz. */
    setApiKey(config.providerKeys?.[p] ?? "");
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
    /* Anahtar boşsa sağlayıcı için kayıtlı anahtarı kullan; doluysa onu hem
       modele yaz hem de sağlayıcı hafızasına kaydet (ömür boyu hatırlanır). */
    const key = apiKey.trim() || config.providerKeys?.[provider] || "";
    if (apiKey.trim()) {
      saveConfig({ ...config, providerKeys: { ...config.providerKeys, [provider]: apiKey.trim() } });
    }
    addModel({ label: label.trim() || model.trim(), provider, baseUrl: baseUrl.trim(), model: model.trim(), apiKey: key });
    addToast("Model eklendi.", "success");
    setLabel("");
  };

  const submitGithub = async () => {
    if (!ghToken.trim()) { addToast("GitHub token gerekli (ghp_...).", "error"); return; }
    setVerifyingGithub(true);
    try {
      /* Token'ı eklemeden ÖNCE doğrula → anında net geri bildirim, sessiz hata yok. */
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${ghToken.trim()}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        addToast(
          res.status === 401 ? "Token geçersiz veya süresi dolmuş — yeni bir PAT oluştur."
          : res.status === 403 ? "Token yetkisiz/oran sınırı — 'repo' kapsamı gerekli."
          : `GitHub doğrulama hatası (${res.status}).`,
          "error",
        );
        return;
      }
      const user = await res.json() as { login?: string };
      addGithub({ username: ghUser.trim() || user.login || "github", token: ghToken.trim() });
      addToast(`GitHub bağlandı: ${user.login} ✓`, "success");
      setGhUser(""); setGhToken("");
    } catch (e) {
      addToast(`Ağ hatası: ${(e as Error).message}`, "error");
    } finally {
      setVerifyingGithub(false);
    }
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
      addToast(res.ok ? "Bağlantı başarılı!" : `Hata: ${(await res.text()).slice(0, 200)}`, res.ok ? "success" : "error");
    } catch (err) { addToast(`Hata: ${(err as Error).message}`, "error"); }
    finally { setTesting(false); }
  };

  /* Anahtar alma sayfaları (bilinenler; olmayanlarda link gizlenir). */
  const QUICK_KEY_URL: Partial<Record<Provider, string>> = {
    gemini: "https://aistudio.google.com/apikey",
    groq: "https://console.groq.com/keys",
    deepseek: "https://platform.deepseek.com/api_keys",
    openrouter: "https://openrouter.ai/keys",
    anthropic: "https://console.anthropic.com/settings/keys",
    mistral: "https://console.mistral.ai/api-keys",
    cerebras: "https://cloud.cerebras.ai",
    together: "https://api.together.xyz/settings/api-keys",
    xai: "https://console.x.ai",
    hf: "https://huggingface.co/settings/tokens",
    github: "https://github.com/settings/tokens",
  };
  /* Hızlı kurulumda sunulan sağlayıcılar (anahtar gerektirenler; pollinations
     anahtarsız çalışır, ollama yereldir, custom manuel → alttaki formdan eklenir). */
  const QUICK_PROVIDERS: Provider[] = ["gemini", "groq", "github", "openrouter", "deepseek", "anthropic", "mistral", "cerebras", "together", "xai", "hf"];
  /* PRESET etiketinden kısa, temiz ad (emoji + parantez kırpılır). */
  const cleanLabel = (p: Provider) => PRESETS[p].label.replace(/\s*\([^)]*\)\s*$/, "").replace(/^[^\p{L}]*/u, "").trim();

  /* Ücretsiz modeli ekle, aktif yap ve canlı test et. */
  const quickSetup = async () => {
    const key = quickKey.trim();
    if (!key) { addToast("Önce ücretsiz anahtarı yapıştır.", "error"); return; }
    const preset = PRESETS[quickProvider];
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `m_${Date.now()}`;
    const newModel = {
      id,
      label: cleanLabel(quickProvider),
      provider: quickProvider as Provider,
      baseUrl: preset.baseUrl,
      model: preset.model,
      apiKey: key,
    };
    /* addModel mevcut aktif modeli korur; burada yeni modeli aktif yapıyoruz.
       Anahtar sağlayıcı hafızasına da kaydedilir → ömür boyu hatırlanır. */
    saveConfig({
      ...config,
      models: [...config.models, newModel],
      activeModelId: id,
      providerKeys: { ...config.providerKeys, [quickProvider]: key },
    });
    setQuickBusy(true);
    setQuickResult(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Merhaba" }], baseUrl: preset.baseUrl, model: preset.model, apiKey: key, provider: quickProvider }),
      });
      if (res.ok) {
        setQuickResult("ok");
        setQuickKey("");
        addToast("Model eklendi ve çalışıyor — artık aktif.", "success");
      } else {
        const t = (await res.text()).slice(0, 140);
        setQuickResult(t || `HTTP ${res.status}`);
        addToast("Model eklendi ama test başarısız.", "error");
      }
    } catch (e) {
      setQuickResult((e as Error).message);
      addToast(`Test hatası: ${(e as Error).message}`, "error");
    } finally {
      setQuickBusy(false);
    }
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
          {([["model", "Model"], ["github", "Git"], ["general", "Temel"], ["advanced", "Gelişmiş"], ["mcp", "MCP"], ["hooks", "Kancalar"]] as const).map(([key, lbl]) => {
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
            
            {/* Hızlı kurulum: ücretsiz, güvenilir model */}
            <div className="mb-4 rounded-xl border border-brand/30 bg-brand/8 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand mb-1.5">
                <Zap size={14} /> Hızlı kurulum — bir sağlayıcı seç, anahtarı yapıştır
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-2.5">
                Sağlayıcıyı seç, anahtarını yapıştır — base URL ve varsayılan model otomatik
                ayarlanır, eklenip test edilir ve aktif olur. Anahtar yalnızca tarayıcında kalır.
              </p>
              <select
                value={quickProvider}
                onChange={(e) => { const p = e.target.value as Provider; setQuickProvider(p); setQuickResult(null); setQuickKey(config.providerKeys?.[p] ?? ""); }}
                className="input-mono w-full mb-2.5"
              >
                {QUICK_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{PRESETS[p].label}</option>
                ))}
              </select>
              {QUICK_KEY_URL[quickProvider] && (
                <a
                  href={QUICK_KEY_URL[quickProvider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:text-branddim underline mb-2"
                >
                  {cleanLabel(quickProvider)} anahtarı al <ExternalLink size={11} />
                </a>
              )}
              <div className="flex gap-1.5">
                <input
                  value={quickKey}
                  onChange={(e) => { setQuickKey(e.target.value); setQuickResult(null); }}
                  placeholder={PRESETS[quickProvider].keyHint}
                  className="input-mono flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !quickBusy) quickSetup(); }}
                />
                <button
                  onClick={quickSetup}
                  disabled={quickBusy || !quickKey.trim()}
                  className="px-3 py-2 rounded-lg bg-brand hover:bg-branddim text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  {quickBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ekle ve test et
                </button>
              </div>
              {quickResult === "ok" && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green font-semibold">
                  <Check size={12} /> Çalışıyor — bu model artık aktif.
                </div>
              )}
              {quickResult && quickResult !== "ok" && (
                <div className="mt-2 text-[11px] text-red break-words">Test başarısız: {quickResult}</div>
              )}
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
                  <input value={ghUser} onChange={(e) => setGhUser(e.target.value)} placeholder="Kullanıcı adı (opsiyonel)" className="input-mono" />
                  <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !verifyingGithub) submitGithub(); }} placeholder="GitHub token (ghp_...)" className="input-mono" />
                  <button onClick={submitGithub} disabled={verifyingGithub} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors disabled:opacity-50">{verifyingGithub ? <><Loader2 size={15} className="animate-spin" /> Doğrulanıyor…</> : <><Plus size={15} /> Bağla &amp; Doğrula</>}</button>
                </div>
              </div>
            </div>

            {/* Repositories */}
            <div>
              <h4 className="text-sm font-bold mb-1">Depolar</h4>
              <p className="text-xs text-muted mb-2">Aktif depo Coder&apos;da otomatik bağlanır. En fazla 12 depo kaydedilir.</p>
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

              {/* Hesabındaki depolar — bağlı hesaptan otomatik gelir */}
              {(loadingAccountRepos || accountRepos.length > 0) && (
                <div className="mt-3 rounded-xl border border-line p-3.5 bg-bgsoft/50">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-xs font-bold text-muted uppercase tracking-wide">Hesabındaki depolar</div>
                    {accountRepos.length > 0 && (
                      <button
                        onClick={() => { accountRepos.forEach((r) => addRepo(r)); addToast(`${accountRepos.length} depo eklendi.`, "success"); setAccountRepos([]); }}
                        className="text-[11px] text-brand hover:underline font-semibold"
                      >
                        Tümünü ekle ({accountRepos.length})
                      </button>
                    )}
                  </div>
                  {loadingAccountRepos ? (
                    <div className="flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Depolar getiriliyor…</div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-auto">
                      {accountRepos.map((r) => (
                        <button
                          key={r}
                          onClick={() => { addRepo(r); setAccountRepos((prev) => prev.filter((x) => x !== r)); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line hover:border-brand bg-bg/40 text-left transition-colors"
                        >
                          <Plus size={12} className="text-brand shrink-0" />
                          <span className="flex-1 text-xs font-mono truncate">{r}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                    <div className="text-sm font-semibold">Terminal panelini otomatik aç</div>
                    <div className="text-xs text-muted mt-0.5">Kapalıyken terminal yalnızca arkaplanda çalışır; komutlar ve çıktıları sohbette &quot;Terminal&quot; todo kutusunda görünür. Açıksa görünür panel de otomatik açılır.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={config.inlineCompletion !== false} onChange={() => saveConfig({ ...config, inlineCompletion: config.inlineCompletion === false })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Satır içi AI tamamlama</div>
                    <div className="text-xs text-muted mt-0.5">Editörde yazarken ghost-text önerisi (Tab ile kabul). Aktif modelin API kotasını kullanır.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-amber-400/50 transition-colors">
                  <input type="checkbox" checked={!!config.safeMode} onChange={() => saveConfig({ ...config, safeMode: !config.safeMode })} className="accent-amber-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Güvenli Mod (salt-okunur)</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken ajan HİÇBİR değişiklik yapamaz: yazma, silme, yeniden adlandırma, dal/PR ve komut araçları tamamen devre dışı. Yalnızca okuma, arama ve analiz. Değişiklik gerekirse kod bloğu olarak önerir. Composer&apos;daki ⋯ menüsünden de açılır.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.requireWriteApproval} onChange={() => saveConfig({ ...config, requireWriteApproval: !config.requireWriteApproval })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Yazma için onay iste</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken ajan dosyaları doğrudan commit etmez; değişiklikleri kod bloğu olarak önerir, sen commit arayüzüyle uygularsın.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.autoRunCommands} onChange={() => saveConfig({ ...config, autoRunCommands: !config.autoRunCommands })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Güvenli oto-çalıştır</div>
                    <div className="text-xs text-muted mt-0.5">AI&apos;nın önerdiği SADECE izin listesindeki komutlar (npm test, lint vb.) otomatik çalışır; çıktı AI&apos;ya beslenir → kendi hatasını düzeltir. Diğer komutlar elle.</div>
                  </div>
                </label>
                {config.autoRunCommands && (
                  <div className="ml-7 -mt-1">
                    <div className="text-xs text-muted mb-1">İzinli komutlar (her satıra bir önek):</div>
                    <textarea
                      value={(config.commandAllowlist ?? []).join("\n")}
                      onChange={(e) => saveConfig({ ...config, commandAllowlist: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                      rows={4}
                      className="input-mono !text-xs leading-relaxed w-full"
                      placeholder="npm test&#10;npm run lint&#10;npx tsc"
                    />
                  </div>
                )}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-amber-400/50 transition-colors">
                  <input type="checkbox" checked={config.commandGuard !== false} onChange={() => saveConfig({ ...config, commandGuard: config.commandGuard === false })} className="accent-amber-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Tehlikeli komut kalkanı</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken (varsayılan) ajanın çalıştırmak istediği <b>katastrofik</b> komutlar (<code>rm -rf /</code>, fork bomb, <code>mkfs</code>, <code>curl | sh</code>, sistem kapatma…) çalıştırılmadan engellenir ve ajana geri bildirilir. Normal komutlar (<code>npm test</code>, <code>rm -rf node_modules</code>…) etkilenmez.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.planApprovalMode} onChange={() => saveConfig({ ...config, planApprovalMode: !config.planApprovalMode })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Plan onay modu</div>
                    <div className="text-xs text-muted mt-0.5">Ajan önce bir plan sunar ve durur; değişiklik yapmaz. Sen &quot;Onayla &amp; Uygula&quot; deyince uygulamaya başlar.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.blockNetworkTools} onChange={() => saveConfig({ ...config, blockNetworkTools: !config.blockNetworkTools })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Ağ erişimini engelle</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken ajan internet araçlarını (web arama / sayfa okuma) kullanamaz. Gizlilik/güvenlik için.</div>
                  </div>
                </label>
                <ToolPermissions />
              </div>
            </div>

            {/* .rules dosyası */}
            <div>
              <h4 className="text-sm font-bold mb-1">.rules — Proje Kuralları</h4>
              <p className="text-xs text-muted mb-2">
                Coder&apos;da her istekte sistem promptuna eklenir. Teknoloji tercihlerin, kod stili, kısıtlamalar.
              </p>
              <textarea
                value={rulesFileDraft}
                onChange={(e) => setRulesFileDraft(e.target.value)}
                onBlur={() => saveConfig({ ...config, rulesFile: rulesFileDraft })}
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
              <button onClick={toggleTheme} disabled={!!config.autoTheme} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm disabled:opacity-50 w-full">
                {config.theme === "dark" ? <><Moon size={15} /> Koyu tema</> : <><Sun size={15} /> Açık tema</>}
                <span className="text-muted ml-auto text-xs">Değiştir</span>
              </button>
              <label className="flex items-center gap-2 mt-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={!!config.autoTheme} onChange={() => saveConfig({ ...config, autoTheme: !config.autoTheme })} className="accent-brand" />
                Sistem temasını izle (işletim sistemine göre otomatik)
              </label>
            </div>

            {/* Yedekle / geri yükle */}
            <div>
              <h4 className="text-sm font-bold mb-2">Yedek</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const s = useStore.getState();
                    const data = JSON.stringify({ version: 1, exportedAt: Date.now(), config: s.config, chats: s.chats }, null, 2);
                    const blob = new Blob([data], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `craftcoder-yedek-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click(); URL.revokeObjectURL(url);
                    addToast("Yedek indirildi (ayarlar + sohbetler)", "success");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm"
                >
                  <Download size={14} /> Yedek indir
                </button>
                <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm cursor-pointer">
                  <Upload size={14} /> Geri yükle
                  <input
                    type="file" accept="application/json" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const data = JSON.parse(await file.text());
                        useStore.getState().importBackup({ config: data.config, chats: data.chats });
                        addToast("Yedek geri yüklendi ✓", "success");
                      } catch { addToast("Geçersiz yedek dosyası", "error"); }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted/60 mt-1.5">API anahtarları da dahil — dosyayı güvende tut.</p>
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
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <label className="text-xs">
                    <span className="text-muted block mb-1">Model</span>
                    <select
                      value={activeProj.modelId ?? ""}
                      onChange={(e) => updateProject(activeProj.id, { modelId: e.target.value || undefined })}
                      className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="">Varsayılan</option>
                      {config.models.map((m) => (
                        <option key={m.id} value={m.id}>{m.label || m.model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="text-muted block mb-1">Sıcaklık</span>
                    <input
                      type="number" min={0} max={2} step={0.1}
                      value={activeProj.temperature ?? ""}
                      onChange={(e) => updateProject(activeProj.id, { temperature: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="varsayılan"
                      className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted block mb-1">Max token</span>
                    <input
                      type="number" min={1} step={256}
                      value={activeProj.maxTokens ?? ""}
                      onChange={(e) => updateProject(activeProj.id, { maxTokens: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="varsayılan"
                      className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Sistem promptu */}
            <div>
              <h4 className="text-sm font-bold mb-1">Sistem Promptu</h4>
              <textarea value={systemPromptDraft} onChange={(e) => setSystemPromptDraft(e.target.value)} onBlur={() => saveConfig({ ...config, systemPrompt: systemPromptDraft })} rows={4} className="input-mono !text-xs leading-relaxed" />
              <button onClick={() => { saveConfig({ ...config, systemPrompt: DEFAULT_SYSTEM_PROMPT }); setSystemPromptDraft(DEFAULT_SYSTEM_PROMPT); }} className="text-xs text-muted hover:text-brand mt-1">Varsayılana sıfırla</button>
            </div>

            {/* Bağlam limiti */}
            <div>
              <h4 className="text-sm font-bold mb-2">Bağlam Penceresi</h4>
              <select value={config.maxContext} onChange={(e) => saveConfig({ ...config, maxContext: Number(e.target.value) })} className="input-mono text-xs">
                {[4096, 8192, 16384, 32768, 65536, 131072, 200000, 400000, 1000000, 2000000].map((n) => (
                  <option key={n} value={n}>{n >= 1000000 ? `${(n / 1000000).toFixed(0)}M token` : `${(n / 1024).toFixed(0)}K token`}</option>
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
            {/* Ajan davranışı (Temel'den taşındı) */}
            <div>
              <h4 className="text-sm font-bold mb-2">Ajan Davranışı</h4>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={config.followUps} onChange={() => saveConfig({ ...config, followUps: !config.followUps })} className="accent-brand" />
                  Takip soruları öner
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={config.webSearch} onChange={() => saveConfig({ ...config, webSearch: !config.webSearch })} className="accent-brand" />
                  Web arama (varsayılan açık)
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={config.autoMemory !== false} onChange={() => saveConfig({ ...config, autoMemory: config.autoMemory === false })} className="accent-brand" />
                  Otomatik bellek — kalıcı tercihleri 🧠 skill&apos;ine damıt
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={config.autoContinue !== false} onChange={() => saveConfig({ ...config, autoContinue: config.autoContinue === false })} className="accent-brand" />
                  Otomatik devam — yanıt token sınırında kesilirse kendiliğinden sürdür
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!config.qualityMode} onChange={() => saveConfig({ ...config, qualityMode: !config.qualityMode })} className="accent-brand" />
                  Kalite modu — taslak → öz-eleştiri → düzeltme (daha doğru, biraz daha yavaş)
                </label>
              </div>
            </div>

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

            {/* Terminal WebSocket URL */}
            <div>
              <h4 className="text-sm font-bold mb-1">Terminal Sunucusu (WebSocket)</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Kendi Linux sunucunu veya Oracle Cloud ücretsiz VM&apos;ini bağla.{" "}
                <strong className="text-muted">Boş bırakırsan</strong> WebContainer sandbox kullanılır.
                <br />
                Örnek:{" "}
                <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">wss://sunucu-ip:7071?token=SIFRE</code>
                <br />
                <span className="text-muted/50 text-[11px]">
                  Kendi bilgisayarın için hazır ücretsiz köprü:{" "}
                  <code className="bg-bgsoft px-1 rounded">scripts/terminal-bridge/</code> (README&apos;ye bak) →{" "}
                  <code className="bg-bgsoft px-1 rounded text-[11px]">ws://localhost:7777/?token=...</code>
                </span>
              </p>
              <input
                type="text"
                value={config.terminalWsUrl ?? ""}
                onChange={(e) => saveConfig({ ...config, terminalWsUrl: e.target.value.trim() })}
                placeholder="ws://localhost:7777/?token=..."
                className="input-mono w-full"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Otomasyon: bağlanınca çalışacak kurulum komutu (SessionStart) */}
              <h4 className="text-sm font-bold mt-4 mb-1">Bağlanınca kurulum komutu</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Terminal her bağlandığında otomatik çalışır (Claude Code&apos;un SessionStart&apos;ı gibi).
                Örn. <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">npm install &amp;&amp; npm run dev</code>.
                Boş bırakırsan hiçbir şey çalışmaz.
              </p>
              <input
                type="text"
                value={config.terminalSetupCommand ?? ""}
                onChange={(e) => saveConfig({ ...config, terminalSetupCommand: e.target.value })}
                placeholder="npm install && npm run dev"
                className="input-mono w-full"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Otomasyonlar (olaya bağlı komutlar — Claude Code hooks benzeri) */}
            <div>
              <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5"><Zap size={14} className="text-brand" /> Otomasyonlar</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Belirli bir olayda terminalde otomatik komut çalıştır.{" "}
                <strong className="text-muted">Dosya yazınca</strong> = ajan kod yazdığında,{" "}
                <strong className="text-muted">Yanıttan sonra</strong> = her yanıtın ardından. Terminal bağlı olmalı.
              </p>
              <div className="space-y-2">
                {(config.automations ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-bgsoft border border-line/60 rounded-lg px-2 py-2">
                    <input
                      type="checkbox"
                      checked={a.enabled}
                      onChange={(e) => saveConfig({ ...config, automations: (config.automations ?? []).map((x) => x.id === a.id ? { ...x, enabled: e.target.checked } : x) })}
                      className="accent-brand shrink-0"
                      title="Etkin"
                    />
                    <select
                      value={a.event}
                      onChange={(e) => saveConfig({ ...config, automations: (config.automations ?? []).map((x) => x.id === a.id ? { ...x, event: e.target.value as import("@/lib/types").Automation["event"] } : x) })}
                      className="bg-bg border border-line rounded-md px-1.5 py-1 text-xs outline-none shrink-0"
                    >
                      <option value="afterWrite">Dosya yazınca</option>
                      <option value="afterResponse">Yanıttan sonra</option>
                      <option value="preToolUse">Araç öncesi (preToolUse)</option>
                      <option value="postToolUse">Araç sonrası (postToolUse)</option>
                      <option value="onStop">Tur bitince (onStop)</option>
                    </select>
                    <input
                      value={a.command}
                      onChange={(e) => saveConfig({ ...config, automations: (config.automations ?? []).map((x) => x.id === a.id ? { ...x, command: e.target.value } : x) })}
                      placeholder="npm test"
                      className="input-mono flex-1 min-w-0 text-xs py-1"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      onClick={() => saveConfig({ ...config, automations: (config.automations ?? []).filter((x) => x.id !== a.id) })}
                      className="text-muted hover:text-red p-1 shrink-0"
                      title="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => saveConfig({ ...config, automations: [...(config.automations ?? []), { id: crypto.randomUUID(), name: "Otomasyon", event: "afterWrite", command: "", enabled: true }] })}
                className="mt-2 flex items-center justify-center gap-1.5 py-2 w-full rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"
              >
                <Plus size={15} /> Otomasyon Ekle
              </button>
            </div>

            {/* Yerel Mod (Local Bridge) */}
            <div>
              <h4 className="text-sm font-bold mb-1">🖥️ Yerel Mod (Local Bridge)</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Açıkken ajan GitHub/GitLab API yerine{" "}
                <strong className="text-muted">kendi bilgisayarındaki gerçek dosya sistemine ve kabuğa</strong>{" "}
                erişir (Claude Code gibi). Tamamen ücretsiz; sunucu/bulut yok.
                <br />
                Köprüyü çalıştır:{" "}
                <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">cd local-bridge &amp;&amp; BRIDGE_TOKEN=gizli WORK_DIR=/proje node server.js</code>
                <br />
                <span className="text-muted/50 text-[11px]">Yalnızca localhost dinler; token zorunlu. Uygulamayı yerelde (npm run dev) çalıştırırken kullan.</span>
              </p>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={!!config.localMode}
                  onChange={(e) => saveConfig({ ...config, localMode: e.target.checked })}
                  className="accent-brand"
                />
                <span className="text-sm">Yerel Mod&apos;u etkinleştir (repo işlemleri köprüye gider)</span>
              </label>
              <input
                type="text"
                value={config.localBridgeUrl ?? ""}
                onChange={(e) => saveConfig({ ...config, localBridgeUrl: e.target.value.trim() })}
                placeholder="http://localhost:4319"
                className="input-mono w-full mb-2"
                autoComplete="off"
                spellCheck={false}
              />
              <input
                type="password"
                value={config.localBridgeToken ?? ""}
                onChange={(e) => saveConfig({ ...config, localBridgeToken: e.target.value })}
                placeholder="Köprü token'ı (BRIDGE_TOKEN)"
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
                  { k: "amber",  label: "Amber",   color: "bg-[#c8a87e]" },
                  { k: "green",  label: "Yeşil",   color: "bg-[#3ddc84]" },
                  { k: "orange", label: "Turuncu", color: "bg-[#f97316]" },
                ] as { k: "amber" | "green" | "orange"; label: string; color: string }[]).map(({ k, label, color }) => (
                  <button
                    key={k}
                    onClick={() => {
                      saveConfig({ ...config, accentColor: k });
                      const cls = document.documentElement.classList;
                      cls.remove("accent-amber", "accent-green", "accent-orange");
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

        {/* MCP */}
        {tab === "mcp" && (
          <section className="space-y-5">
            <div>
              <h4 className="text-sm font-bold mb-1">MCP Sunucuları</h4>
              <p className="text-xs text-muted mb-3">Model Context Protocol — AI&apos;ya harici araçlar bağla (veritabanı, dosya sistemi, API vb.). Sunucu JSON-RPC 2.0 üzerinden HTTP ile erişilebilir olmalı.</p>

              {(config.mcpServers ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
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
                        onClick={async () => {
                          setMcpTesting(srv.id);
                          try {
                            const res = await fetch("/api/mcp", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "list", server: { url: srv.url, headers: srv.headers } }),
                            });
                            const data = await res.json() as { tools?: { name: string }[]; error?: string };
                            if (data.tools) addToast(`${data.tools.length} araç bulundu`, "success");
                            else addToast(data.error ?? "Bağlanamadı", "error");
                          } catch { addToast("Bağlantı hatası", "error"); }
                          finally { setMcpTesting(null); }
                        }}
                        disabled={mcpTesting === srv.id}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-brand hover:border-brand transition-colors disabled:opacity-50"
                      >
                        {mcpTesting === srv.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      </button>
                      <button onClick={() => removeMcpServer(srv.id)} className="text-muted hover:text-red/80 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border border-line/60 rounded-xl p-3 bg-bgsoft/40">
                <div className="text-xs font-semibold text-muted mb-2">Yeni Sunucu Ekle</div>
                <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="Sunucu adı (örn. My DB Tools)" className="input-mono w-full" />
                <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="URL (örn. http://localhost:3001)" className="input-mono w-full" />
                <div className="flex gap-2">
                  <input value={mcpHeaderKey} onChange={(e) => setMcpHeaderKey(e.target.value)} placeholder="Header adı (opsiyonel)" className="input-mono flex-1" />
                  <input value={mcpHeaderVal} onChange={(e) => setMcpHeaderVal(e.target.value)} placeholder="Değer" className="input-mono flex-1" />
                </div>
                <button
                  onClick={() => {
                    if (!mcpName.trim() || !mcpUrl.trim()) { addToast("Ad ve URL zorunlu.", "error"); return; }
                    const headers: Record<string, string> = {};
                    if (mcpHeaderKey.trim()) headers[mcpHeaderKey.trim()] = mcpHeaderVal.trim();
                    addMcpServer({ name: mcpName.trim(), url: mcpUrl.trim(), headers: Object.keys(headers).length ? headers : undefined, enabled: true });
                    setMcpName(""); setMcpUrl(""); setMcpHeaderKey(""); setMcpHeaderVal("");
                    addToast("MCP sunucusu eklendi.", "success");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-branddim transition-colors"
                >
                  <Plus size={14} /> Ekle
                </button>
              </div>
            </div>

            <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-xs text-muted space-y-1.5">
              <div className="font-semibold text-brand">MCP nedir?</div>
              <p>Model Context Protocol, Anthropic tarafından geliştirilen bir standarttır. Kendi araçlarını (veritabanı sorgu, dosya okuma, API çağrısı vb.) Craft.Coder&apos;a bağlayarak AI&apos;ın bunları otomatik kullanmasını sağlar.</p>
              <p>Aktif sunucuların araçları, araç kullanımı açıkken her sohbette AI&apos;a sunulur.</p>
            </div>
          </section>
        )}

        {/* Hooks — olay kancaları */}
        {tab === "hooks" && (
          <section className="space-y-5">
            <div>
              <h4 className="text-sm font-bold mb-1">Olay Kancaları</h4>
              <p className="text-xs text-muted mb-3">Ajan bir turu bitirince otomatik kabuk komutu çalıştır. <b>Düzenleme sonrası</b> kancalarının çıktısı ajana geri beslenir → lint/test/tip hatalarını kendi kendine düzeltir (Claude Code &quot;hooks&quot; mantığı). <b>Bitişte</b> ve <b>Hata olunca</b> kancaları yalnız bildirir (geri besleme yok; Yerel Mod köprüsü gerekir).</p>

              {(config.hooks ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {(config.hooks ?? []).map((h) => (
                    <div key={h.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-bgsoft">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${h.event === "afterEdit" ? "bg-brand/15 text-brand" : h.event === "onError" ? "bg-red/15 text-red" : "bg-amber/15 text-amber"}`}>
                            {h.event === "afterEdit" ? "Düzenleme sonrası" : h.event === "onError" ? "Hata olunca" : "Bitişte"}
                          </span>
                          {h.label && <span className="text-sm font-semibold truncate">{h.label}</span>}
                        </div>
                        <div className="text-xs text-muted font-mono truncate mt-0.5">{h.command}</div>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={() => updateHook(h.id, { enabled: !h.enabled })}
                          className="accent-brand"
                        />
                        Aktif
                      </label>
                      <button onClick={() => removeHook(h.id)} className="text-muted hover:text-red/80 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border border-line/60 rounded-xl p-3 bg-bgsoft/40">
                <div className="text-xs font-semibold text-muted mb-2">Yeni Kanca Ekle</div>
                <div className="flex gap-2">
                  <select value={hookEvent} onChange={(e) => setHookEvent(e.target.value as "afterEdit" | "onFinish" | "onError")} className="input-mono">
                    <option value="afterEdit">Düzenleme sonrası</option>
                    <option value="onFinish">Bitişte</option>
                    <option value="onError">Hata olunca</option>
                  </select>
                  <input value={hookLabel} onChange={(e) => setHookLabel(e.target.value)} placeholder="Etiket (opsiyonel)" className="input-mono flex-1" />
                </div>
                <input value={hookCommand} onChange={(e) => setHookCommand(e.target.value)} placeholder="Komut (örn. npm run lint, npm test)" className="input-mono w-full" />
                <button
                  onClick={() => {
                    if (!hookCommand.trim()) { addToast("Komut zorunlu.", "error"); return; }
                    addHook({ label: hookLabel.trim() || undefined, event: hookEvent, command: hookCommand.trim(), enabled: true });
                    setHookLabel(""); setHookCommand("");
                    addToast("Kanca eklendi.", "success");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-branddim transition-colors"
                >
                  <Plus size={14} /> Ekle
                </button>
              </div>
            </div>

            <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-xs text-muted space-y-1.5">
              <div className="font-semibold text-brand">Nasıl çalışır?</div>
              <p><b>Düzenleme sonrası</b>: ajan dosya yazdığı her turdan sonra komut çalışır, çıktı ajana geri beslenir (en çok 3 tur). Örn. <span className="font-mono">npm run lint</span> → hatalar ajana gider, düzeltir.</p>
              <p><b>Bitişte</b>: ajan tamamen durunca komut çalışır (yalnız bildirim). Örn. <span className="font-mono">npm test</span>.</p>
              <p className="text-amber">Komutlar Yerel Mod köprüsünde çalışır. Köprü kapalıyken &quot;Düzenleme sonrası&quot; kancaları yerleşik terminale düşer; &quot;Bitişte&quot; kancaları yalnız Yerel Mod&apos;da çalışır.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* Granüler araç-izin tablosu: her aracı kategori bazında allow/deny yapar.
   Reddedilenler (toolPermissions[name] === false) ajana hiç sunulmaz. */
function ToolPermissions() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const perms = config.toolPermissions ?? {};
  const isAllowed = (name: string) => perms[name] !== false;
  const setPerm = (names: string[], allowed: boolean) => {
    const next = { ...perms };
    for (const n of names) { if (allowed) delete next[n]; else next[n] = false; }
    saveConfig({ ...config, toolPermissions: next });
  };

  const categories: string[] = [];
  for (const t of ALL_TOOL_CATALOG) if (!categories.includes(t.category)) categories.push(t.category);
  const riskColor: Record<string, string> = { low: "bg-muted/40", medium: "bg-amber-400", high: "bg-red" };
  const riskLabel: Record<string, string> = { low: "düşük", medium: "orta", high: "yüksek" };
  const deniedCount = ALL_TOOL_CATALOG.filter((t) => !isAllowed(t.name)).length;

  return (
    <div className="rounded-xl border border-line bg-bgsoft overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line/60">
        <div className="flex-1">
          <div className="text-sm font-semibold">Araç izinleri</div>
          <div className="text-xs text-muted mt-0.5">
            Ajanın kullanabileceği araçları tek tek aç/kapat. Kapatılan araç ajana hiç sunulmaz.
            {deniedCount > 0 && <span className="text-amber-400"> · {deniedCount} araç kapalı</span>}
          </div>
        </div>
        {deniedCount > 0 && (
          <button
            onClick={() => saveConfig({ ...config, toolPermissions: {} })}
            className="text-xs text-brand hover:underline shrink-0"
          >
            Tümünü aç
          </button>
        )}
      </div>
      <div className="divide-y divide-line/40">
        {categories.map((cat) => {
          const tools = ALL_TOOL_CATALOG.filter((t) => t.category === cat);
          const allOn = tools.every((t) => isAllowed(t.name));
          return (
            <div key={cat} className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted/60 flex-1">{cat}</span>
                <button
                  onClick={() => setPerm(tools.map((t) => t.name), !allOn)}
                  className="text-[10px] text-muted/60 hover:text-brand transition-colors"
                >
                  {allOn ? "kategoriyi kapat" : "kategoriyi aç"}
                </button>
              </div>
              <div className="space-y-0.5">
                {tools.map((t) => {
                  const on = isAllowed(t.name);
                  return (
                    <label key={t.name} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                      <input type="checkbox" checked={on} onChange={() => setPerm([t.name], !on)} className="accent-brand" />
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${riskColor[t.risk]}`} title={`Risk: ${riskLabel[t.risk]}`} />
                      <span className={`text-xs flex-1 ${on ? "text-ink" : "text-muted/40 line-through"}`}>{t.label}</span>
                      <span className="text-[10px] font-mono text-muted/40">{t.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
