"use client";

import {
  X,
  Plus,
  Trash2,
  Play,
  Check,
  Globe,
  Cpu,
  GitBranch,
  Palette,
  Type,
  Volume2,
  Eye,
  Key,
  CloudLightning,
  TestTube,
  ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { Provider, ModelEntry, Config, GitAccount, Project } from "@/lib/types";

// ── Sağlayıcı bilgileri ──

const PROVIDERS: Array<{ id: Provider; label: string; defaultUrl: string }> = [
  { id: "hf", label: "Hugging Face", defaultUrl: "https://api-inference.huggingface.co/v1" },
  { id: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { id: "deepseek", label: "DeepSeek", defaultUrl: "https://api.deepseek.com/v1" },
  { id: "groq", label: "Groq", defaultUrl: "https://api.groq.com/openai/v1" },
  { id: "google", label: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { id: "mistral", label: "Mistral", defaultUrl: "https://api.mistral.ai/v1" },
  { id: "cerebras", label: "Cerebras", defaultUrl: "https://api.cerebras.ai/v1" },
  { id: "together", label: "Together AI", defaultUrl: "https://api.together.xyz/v1" },
  { id: "xai", label: "xAI (Grok)", defaultUrl: "https://api.x.ai/v1" },
  { id: "ollama", label: "Ollama (Yerel)", defaultUrl: "http://localhost:11434/v1" },
  { id: "custom", label: "Özel", defaultUrl: "" },
];

type SettingsTab = "model" | "git" | "general" | "advanced";

// ── Ana bileşen ──

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const models = useStore((s) => s.models);
  const addModel = useStore((s) => s.addModel);
  const removeModel = useStore((s) => s.removeModel);
  const setModels = useStore((s) => s.setModels);
  const gitAccounts = useStore((s) => s.gitAccounts);
  const addGitAccount = useStore((s) => s.addGitAccount);
  const removeGitAccount = useStore((s) => s.removeGitAccount);
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);

  const [tab, setTab] = useState<SettingsTab>("model");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setSettingsOpen]);

  if (!open) return null;

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Cpu }> = [
    { id: "model", label: "Model", icon: Cpu },
    { id: "git", label: "Git", icon: GitBranch },
    { id: "general", label: "Genel", icon: Palette },
    { id: "advanced", label: "Gelişmiş", icon: Key },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Ayarlar"
    >
      <div
        ref={panelRef}
        className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold">Ayarlar</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors"
            aria-label="Kapat"
          >
            <X size={15} />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0 border-b border-line/50">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? "bg-amber-400 text-black" : "bg-bgsoft text-muted hover:text-ink"
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Sekme içerikleri */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "model" && <ModelTab models={models} addModel={addModel} removeModel={removeModel} setModels={setModels} addToast={addToast} />}
          {tab === "git" && <GitTab gitAccounts={gitAccounts} addGitAccount={addGitAccount} removeGitAccount={removeGitAccount} projects={projects} setProjects={setProjects} addToast={addToast} />}
          {tab === "general" && <GeneralTab config={config} setConfig={setConfig} />}
          {tab === "advanced" && <AdvancedTab config={config} setConfig={setConfig} user={user} />}
        </div>
      </div>
    </div>
  );
}

// ── Model Sekmesi ──

function ModelTab({
  models,
  addModel,
  removeModel,
  setModels,
  addToast,
}: {
  models: ModelEntry[];
  addModel: (m: ModelEntry) => void;
  removeModel: (id: string) => void;
  setModels: (models: ModelEntry[]) => void;
  addToast: (t: { message: string; type?: "info" | "success" | "error" | "warning" }) => void;
}) {
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fetchedModels, setFetchedModels] = useState<Array<{ id: string; name: string }>>([]);
  const [fetching, setFetching] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);

  useEffect(() => {
    if (selectedProvider) setBaseUrl(selectedProvider.defaultUrl);
  }, [provider, selectedProvider]);

  const handleFetchModels = useCallback(async () => {
    if (!apiKey.trim() || !baseUrl.trim()) {
      addToast({ message: "API anahtarı ve Base URL gerekli", type: "warning" });
      return;
    }
    setFetching(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFetchedModels(data.models ?? []);
      addToast({ message: `${(data.models ?? []).length} model bulundu`, type: "success" });
    } catch (err) {
      addToast({ message: `Model listesi alınamadı: ${err instanceof Error ? err.message : "Hata"}`, type: "error" });
    } finally {
      setFetching(false);
    }
  }, [apiKey, baseUrl, addToast]);

  const handleAddModel = (modelId: string, modelName: string) => {
    const model: ModelEntry = {
      id: `model_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: displayName.trim() || modelName,
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelId,
      enabled: true,
    };
    addModel(model);
    addToast({ message: `${model.name} eklendi`, type: "success" });
  };

  const handleDeleteModel = (id: string) => {
    removeModel(id);
    addToast({ message: "Model kaldırıldı", type: "info" });
  };

  const handleToggleModel = (id: string, enabled: boolean) => {
    setModels(models.map((m) => (m.id === id ? { ...m, enabled: !enabled } : m)));
  };

  const handleTestModel = async (model: ModelEntry) => {
    setTestingId(model.id);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Merhaba" }],
          model: model.modelId,
          provider: model.provider,
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          max_tokens: 10,
        }),
      });
      if (res.ok) {
        addToast({ message: `${model.name}: Bağlantı başarılı ✅`, type: "success" });
      } else {
        addToast({ message: `${model.name}: HTTP ${res.status}`, type: "error" });
      }
    } catch (err) {
      addToast({ message: `${model.name}: ${err instanceof Error ? err.message : "Hata"}`, type: "error" });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Model ekle */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-3">+ Yeni Model Ekle</p>
        <div className="space-y-3">
          {/* Sağlayıcı seçici */}
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Sağlayıcı</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Görünen ad */}
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Görünen Ad (opsiyonel)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Örn: GPT-4o Hızlı"
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-amber-400/50"
            />
          </div>

          {/* API Anahtarı */}
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">API Anahtarı</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-amber-400/50"
            />
          </div>

          {/* Model listesini getir */}
          <button
            onClick={handleFetchModels}
            disabled={fetching || !apiKey.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bgsoft border border-line text-xs font-medium text-muted hover:text-ink transition-colors disabled:opacity-40"
          >
            <CloudLightning size={12} />
            {fetching ? "Modeller getiriliyor..." : "↻ Modelleri Getir / Yenile"}
          </button>
        </div>

        {/* Fetched model listesi */}
        {fetchedModels.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">
              Bulunan Modeller ({fetchedModels.length})
            </p>
            {fetchedModels.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30"
              >
                <span className="text-xs flex-1 truncate">{m.name || m.id}</span>
                <button
                  onClick={() => handleAddModel(m.id, m.name || m.id)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium"
                >
                  + Ekle
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eklenmiş modeller */}
      {models.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">
            Eklenen Modeller ({models.length})
          </p>
          <div className="space-y-1">
            {models.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-muted/60 font-mono truncate">{m.modelId}</div>
                </div>
                <button
                  onClick={() => handleTestModel(m)}
                  disabled={testingId === m.id}
                  className="p-1 text-muted/40 hover:text-green-400 transition-colors"
                  title="Test et"
                >
                  {testingId === m.id ? (
                    <span className="animate-spin text-[10px]">⟳</span>
                  ) : (
                    <Play size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleToggleModel(m.id, m.enabled)}
                  className={`p-1 transition-colors ${m.enabled ? "text-amber-400" : "text-muted/40 hover:text-amber-400"}`}
                  title={m.enabled ? "Devre dışı bırak" : "Etkinleştir"}
                >
                  <Check size={14} className={m.enabled ? "" : "opacity-30"} />
                </button>
                <button
                  onClick={() => handleDeleteModel(m.id)}
                  className="p-1 text-muted/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Sil"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Git Sekmesi ──

function GitTab({
  gitAccounts,
  addGitAccount,
  removeGitAccount,
  projects,
  setProjects,
  addToast,
}: {
  gitAccounts: GitAccount[];
  addGitAccount: (a: GitAccount) => void;
  removeGitAccount: (id: string) => void;
  projects: Project[];
  setProjects: (p: Project[]) => void;
  addToast: (t: { message: string; type?: "info" | "success" | "error" | "warning" }) => void;
}) {
  const [gitProvider, setGitProvider] = useState<"github" | "gitlab">("github");
  const [gitUsername, setGitUsername] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [repoInput, setRepoInput] = useState(""); // sahip/repo:dal
  const [repoBranch, setRepoBranch] = useState("main");

  const handleAddAccount = () => {
    if (!gitUsername.trim() || !gitToken.trim()) {
      addToast({ message: "Kullanıcı adı ve token gerekli", type: "warning" });
      return;
    }
    addGitAccount({
      id: `git_${Date.now()}`,
      provider: gitProvider,
      username: gitUsername.trim(),
      token: gitToken.trim(),
    });
    setGitUsername("");
    setGitToken("");
    addToast({ message: `${gitProvider} hesabı eklendi`, type: "success" });
  };

  const handleAddRepo = () => {
    const parts = repoInput.trim().split("/");
    if (parts.length < 2) {
      addToast({ message: "Format: sahip/repo[:dal]", type: "warning" });
      return;
    }
    const owner = parts[0];
    const repoAndBranch = parts.slice(1).join("/");
    const [repo, branch = repoBranch || "main"] = repoAndBranch.split(":");
    const project: Project = {
      id: `project_${Date.now()}`,
      name: `${owner}/${repo}`,
      repoOwner: owner,
      repoName: repo,
      branch,
      provider: gitProvider,
    };
    setProjects([...projects, project]);
    setRepoInput("");
    addToast({ message: `${owner}/${repo} eklendi`, type: "success" });
  };

  return (
    <div className="space-y-5">
      {/* Git hesabı ekle */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-3">Git Hesabı Ekle</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Sağlayıcı</label>
            <select
              value={gitProvider}
              onChange={(e) => setGitProvider(e.target.value as "github" | "gitlab")}
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Kullanıcı Adı</label>
            <input
              value={gitUsername}
              onChange={(e) => setGitUsername(e.target.value)}
              placeholder="kullaniciadi"
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Token</label>
            <input
              type="password"
              value={gitToken}
              onChange={(e) => setGitToken(e.target.value)}
              placeholder="ghp_... veya glpat-..."
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-amber-400/50"
            />
          </div>
          <button
            onClick={handleAddAccount}
            disabled={!gitUsername.trim() || !gitToken.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 text-black text-xs font-medium hover:bg-amber-300 transition-colors disabled:opacity-40"
          >
            <Plus size={12} />
            Hesap Ekle
          </button>
        </div>

        {/* Mevcut hesaplar */}
        {gitAccounts.length > 0 && (
          <div className="mt-3 space-y-1">
            {gitAccounts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 group">
                <GitBranch size={12} className="text-muted/60" />
                <span className="text-xs flex-1">{a.username} ({a.provider})</span>
                <button
                  onClick={() => removeGitAccount(a.id)}
                  className="text-muted/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repo ekle */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-3">Repo Bağla</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted/70 mb-1 block">Depo (sahip/repo[:dal])</label>
            <input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="sahip/repo:main"
              className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-amber-400/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={repoBranch}
              onChange={(e) => setRepoBranch(e.target.value)}
              placeholder="main"
              className="flex-1 bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
            />
            <button
              onClick={handleAddRepo}
              disabled={!repoInput.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 text-black text-xs font-medium hover:bg-amber-300 transition-colors disabled:opacity-40"
            >
              <Plus size={12} />
              Bağla
            </button>
          </div>
        </div>

        {/* Mevcut repolar */}
        {projects.length > 0 && (
          <div className="mt-3 space-y-1">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 group">
                <Globe size={12} className="text-muted/60" />
                <span className="text-xs flex-1 font-mono">
                  {p.repoOwner}/{p.repoName}
                  <span className="text-muted/60 ml-1">:{p.branch}</span>
                </span>
                <a
                  href={p.provider === "github"
                    ? `https://github.com/${p.repoOwner}/${p.repoName}`
                    : `https://gitlab.com/${p.repoOwner}/${p.repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted/40 hover:text-ink transition-colors"
                >
                  <ExternalLink size={11} />
                </a>
                <button
                  onClick={() => setProjects(projects.filter((pr) => pr.id !== p.id))}
                  className="text-muted/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Genel Sekmesi ──

function GeneralTab({ config, setConfig }: { config: Config; setConfig: (p: Partial<Config>) => void }) {
  return (
    <div className="space-y-5">
      {/* Tema */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Tema</p>
        <div className="flex gap-2">
          {[
            { value: "dark", label: "Koyu", icon: "🌙" },
            { value: "light", label: "Açık", icon: "☀️" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setConfig({ theme: t.value as Config["theme"] })}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                config.theme === t.value
                  ? "bg-amber-400 text-black"
                  : "bg-bgsoft border border-line text-muted hover:text-ink"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Yanıt stili */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Yanıt Stili</p>
        <select
          value={config.responseStyle}
          onChange={(e) => setConfig({ responseStyle: e.target.value as Config["responseStyle"] })}
          className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
        >
          <option value="normal">Normal</option>
          <option value="short">Kısa</option>
          <option value="detailed">Detaylı</option>
          <option value="code">Kod Odaklı</option>
          <option value="formal">Resmi</option>
        </select>
      </div>

      {/* Bellek */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Bellek (Sohbetler arası hatırlanacak notlar)</p>
        <textarea
          value={config.memory}
          onChange={(e) => setConfig({ memory: e.target.value })}
          placeholder="AI'ın sohbetler arası hatırlamasını istediğiniz bilgiler..."
          rows={3}
          className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50 resize-none"
        />
      </div>

      {/* Sistem promptu */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Sistem Promptu</p>
        <textarea
          value={config.systemPrompt}
          onChange={(e) => setConfig({ systemPrompt: e.target.value })}
          placeholder="Varsayılan sistem promptu..."
          rows={4}
          className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50 resize-none font-mono"
        />
      </div>

      {/* Toggle'lar */}
      <div className="space-y-2">
        <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 cursor-pointer">
          <span className="text-xs">Takip Soruları</span>
          <input
            type="checkbox"
            checked={config.followUpQuestions}
            onChange={(e) => setConfig({ followUpQuestions: e.target.checked })}
            className="accent-amber-400"
          />
        </label>
        <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 cursor-pointer">
          <span className="text-xs">Web Arama</span>
          <input
            type="checkbox"
            checked={config.webSearch}
            onChange={(e) => setConfig({ webSearch: e.target.checked })}
            className="accent-amber-400"
          />
        </label>
      </div>

      {/* Bağlam penceresi */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Bağlam Penceresi (Token)</p>
        <input
          type="number"
          value={config.contextWindowTokens}
          onChange={(e) => setConfig({ contextWindowTokens: parseInt(e.target.value) || 128000 })}
          className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400/50"
        />
      </div>
    </div>
  );
}

// ── Gelişmiş Sekmesi ──

function AdvancedTab({
  config,
  setConfig,
  user,
}: {
  config: Config;
  setConfig: (p: Partial<Config>) => void;
  user: { id: string; email?: string } | null;
}) {
  return (
    <div className="space-y-5">
      {/* Guest Mod */}
      <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 cursor-pointer">
        <div>
          <span className="text-xs font-medium">Misafir Mod</span>
          <p className="text-[10px] text-muted/60">Anahtarlar sekme kapanınca silinir</p>
        </div>
        <input
          type="checkbox"
          checked={config.guestMode}
          onChange={(e) => setConfig({ guestMode: e.target.checked })}
          className="accent-amber-400"
        />
      </label>

      {/* WebContainer API key */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">WebContainer API Key (Gerçek Terminal)</p>
        <input
          type="password"
          value={config.webContainerApiKey}
          onChange={(e) => setConfig({ webContainerApiKey: e.target.value })}
          placeholder="wca_..."
          className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-amber-400/50"
        />
      </div>

      {/* Vurgu rengi */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Vurgu Rengi</p>
        <div className="flex gap-2">
          {[
            { value: "amber", label: "Amber", class: "bg-amber-400" },
            { value: "green", label: "Yeşil", class: "bg-green-500" },
            { value: "orange", label: "Turuncu", class: "bg-orange-500" },
          ].map((c) => (
            <button
              key={c.value}
              onClick={() => setConfig({ accentColor: c.value as Config["accentColor"] })}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                config.accentColor === c.value
                  ? "bg-amber-400 text-black"
                  : "bg-bgsoft border border-line text-muted hover:text-ink"
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${c.class}`} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Yazı tipi ölçeği */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">Yazı Tipi Boyutu</p>
        <div className="flex gap-2">
          {[
            { value: "sm", label: "Küçük" },
            { value: "base", label: "Normal" },
            { value: "lg", label: "Büyük" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setConfig({ fontScale: f.value as Config["fontScale"] })}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                config.fontScale === f.value
                  ? "bg-amber-400 text-black"
                  : "bg-bgsoft border border-line text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bildirim sesi */}
      <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 cursor-pointer">
        <div className="flex items-center gap-2">
          <Volume2 size={14} className="text-muted/60" />
          <span className="text-xs">Bildirim Sesi</span>
        </div>
        <input
          type="checkbox"
          checked={config.notificationSound}
          onChange={(e) => setConfig({ notificationSound: e.target.checked })}
          className="accent-amber-400"
        />
      </label>

      {/* İstatistikler */}
      <div className="p-4 rounded-xl bg-bgsoft/50 border border-line/30">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">İstatistikler</p>
        <p className="text-xs text-muted">
          {user ? `Giriş yapan: ${user.email}` : "Misafir kullanıcı — giriş yapılmadı"}
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          Kullanım istatistikleri yakında eklenecek.
        </p>
      </div>
    </div>
  );
}
