"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { AIModel, ProviderKind, ResponseStyle } from "@/lib/types";
import { PROVIDER_DEFAULTS, PROVIDER_LABELS } from "@/lib/constants";

interface Props {
  open?: boolean;
  onClose?: () => void;
}

type TabId = "model" | "git" | "general" | "advanced";

const PROVIDERS: { id: ProviderKind; label: string }[] = [
  { id: "huggingface", label: "Hugging Face" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "groq", label: "Groq" },
  { id: "google", label: "Google Gemini" },
  { id: "mistral", label: "Mistral" },
  { id: "cerebras", label: "Cerebras" },
  { id: "togetherai", label: "Together AI" },
  { id: "xai", label: "xAI (Grok)" },
  { id: "ollama", label: "Ollama (Yerel)" },
  { id: "custom", label: "Özel" },
];

const RESPONSE_STYLES: { id: ResponseStyle; label: string; desc: string }[] = [
  { id: "normal", label: "Normal", desc: "Dengeli yanıtlar" },
  { id: "short", label: "Kısa", desc: "Özlü ve doğrudan" },
  { id: "detailed", label: "Detaylı", desc: "Kapsamlı açıklamalar" },
  { id: "code-focused", label: "Kod odaklı", desc: "Ağırlıklı kod" },
  { id: "formal", label: "Resmi", desc: "Profesyonel dil" },
];

export function SettingsModal({ open, onClose }: Props) {
  const { models, addModel, removeModel, setActiveModel, activeModelId, config, updateConfig } =
    useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("model");

  // Yeni model formu
  const [showNewModel, setShowNewModel] = useState(false);
  const [newProvider, setNewProvider] = useState<ProviderKind>("deepseek");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newName, setNewName] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  // Git formu
  const [gitUsername, setGitUsername] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [gitProvider, setGitProvider] = useState<"github" | "gitlab">("github");

  const isControlled = open !== undefined;
  const visible = isControlled ? open : isOpen;

  const close = useCallback(() => {
    if (isControlled) onClose?.();
    else setIsOpen(false);
  }, [isControlled, onClose]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  useEffect(() => {
    // Sağlayıcı değişince Base URL'yi otomatik doldur
    if (newProvider !== "custom" && newProvider !== "ollama") {
      const def = PROVIDER_DEFAULTS[newProvider];
      if (def && !newBaseUrl) {
        setNewBaseUrl(def);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProvider]);

  const handleAddModel = () => {
    if (!newApiKey.trim()) return;
    const id = `${newProvider}-${Date.now()}`;
    addModel({
      id,
      name: newName.trim() || PROVIDER_LABELS[newProvider] || newProvider,
      provider: newProvider,
      baseURL: newBaseUrl.trim() || (newProvider !== "custom" && newProvider !== "ollama" ? PROVIDER_DEFAULTS[newProvider] : ""),
      apiKey: newApiKey.trim(),
      enabled: models.length === 0,
    });
    setNewApiKey("");
    setNewName("");
    setNewBaseUrl("");
    setShowNewModel(false);
  };

  const handleTest = async (model: AIModel) => {
    setTesting(model.id);
    setTestResult((prev) => ({ ...prev, [model.id]: "" }));
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: model.baseURL, apiKey: model.apiKey }),
      });
      if (res.ok) {
        setTestResult((prev) => ({ ...prev, [model.id]: "✅ Bağlantı başarılı" }));
      } else {
        setTestResult((prev) => ({ ...prev, [model.id]: `❌ HTTP ${res.status}` }));
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [model.id]: "❌ Ağ hatası" }));
    }
    setTesting(null);
  };

  if (!visible) return null;

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "model", label: "Model", icon: "🤖" },
    { id: "git", label: "Git", icon: "🔀" },
    { id: "general", label: "Genel", icon: "⚙️" },
    { id: "advanced", label: "Gelişmiş", icon: "🔧" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-surface)]">
          <h2 className="text-lg font-semibold">⚙️ Ayarlar</h2>
          <button onClick={close} className="text-[var(--color-ink)]/40 hover:text-[var(--color-ink)] transition-colors text-lg">
            ✕
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex border-b border-[var(--color-surface)] px-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                activeTab === t.id
                  ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                  : "border-transparent text-[var(--color-ink)]/50 hover:text-[var(--color-ink)]/70"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ─── MODEL SEKMESİ ─── */}
          {activeTab === "model" && (
            <div className="space-y-4">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface)]/50 transition-colors"
                >
                  {/* Aktif radyo */}
                  <input
                    type="radio"
                    name="activeModel"
                    checked={activeModelId === m.id}
                    onChange={() => setActiveModel(m.id)}
                    className="accent-[var(--color-brand)]"
                    title="Aktif model yap"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {m.name}
                      {activeModelId === m.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-ink)]/40 font-mono truncate">
                      {m.baseURL}
                    </div>
                    {testResult[m.id] && (
                      <div className="text-[11px] mt-1">{testResult[m.id]}</div>
                    )}
                  </div>

                  <button
                    onClick={() => handleTest(m)}
                    disabled={testing === m.id}
                    className="px-2 py-1 text-[10px] rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-brand)]/10 transition-colors disabled:opacity-50"
                    title="Test et"
                  >
                    {testing === m.id ? "⏳" : "▶"}
                  </button>
                  <button
                    onClick={() => removeModel(m.id)}
                    className="text-xs text-[var(--color-ink)]/30 hover:text-red-400 transition-colors"
                    title="Sil"
                  >
                    🗑
                  </button>
                </div>
              ))}

              {models.length === 0 && (
                <p className="text-center text-sm text-[var(--color-ink)]/40 py-6">
                  Henüz model eklenmemiş
                </p>
              )}

              {/* Yeni model ekle */}
              {showNewModel ? (
                <div className="p-4 border border-[var(--color-brand)]/30 rounded-xl space-y-3 bg-[var(--color-surface)]/20">
                  <select
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value as ProviderKind)}
                    className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm outline-none border-none text-[var(--color-ink)]"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Görünen ad (opsiyonel)"
                    className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
                  />
                  <input
                    type="text"
                    value={newBaseUrl}
                    onChange={(e) => setNewBaseUrl(e.target.value)}
                    placeholder="Base URL"
                    className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
                  />
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="API Anahtarı"
                    className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddModel}
                      disabled={!newApiKey.trim()}
                      className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      + Ekle
                    </button>
                    <button
                      onClick={() => setShowNewModel(false)}
                      className="px-4 py-2 text-sm rounded-lg border border-[var(--color-surface)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewModel(true)}
                  className="w-full py-3 text-sm border border-dashed border-[var(--color-surface)] rounded-xl hover:border-[var(--color-brand)]/30 hover:bg-[var(--color-brand)]/5 transition-all"
                >
                  + Yeni Model Ekle
                </button>
              )}
            </div>
          )}

          {/* ─── GIT SEKMESİ ─── */}
          {activeTab === "git" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--color-surface)]/20 space-y-3">
                <label className="block text-xs font-medium text-[var(--color-ink)]/60">
                  Sağlayıcı
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGitProvider("github")}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                      gitProvider === "github"
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                        : "border-[var(--color-surface)] text-[var(--color-ink)]/60"
                    }`}
                  >
                    GitHub
                  </button>
                  <button
                    onClick={() => setGitProvider("gitlab")}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                      gitProvider === "gitlab"
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                        : "border-[var(--color-surface)] text-[var(--color-ink)]/60"
                    }`}
                  >
                    GitLab
                  </button>
                </div>

                <label className="block text-xs font-medium text-[var(--color-ink)]/60">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={gitUsername}
                  onChange={(e) => setGitUsername(e.target.value)}
                  placeholder={gitProvider === "github" ? "GitHub kullanıcı adı" : "GitLab kullanıcı adı"}
                  className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
                />

                <label className="block text-xs font-medium text-[var(--color-ink)]/60">
                  Token
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder="Personal Access Token"
                  className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
                />

                <button className="w-full py-2 text-sm rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity">
                  Hesabı Kaydet
                </button>
              </div>

              <p className="text-xs text-[var(--color-ink)]/40 text-center">
                Birden fazla hesap ekleyebilirsiniz. Her repo için farklı hesap seçilebilir.
              </p>
            </div>
          )}

          {/* ─── GENEL SEKMESİ ─── */}
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Tema */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink)]/60 mb-2">
                  Tema
                </label>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateConfig("theme", t)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize ${
                        config.theme === t
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                          : "border-[var(--color-surface)] text-[var(--color-ink)]/60"
                      }`}
                    >
                      {t === "dark" ? "🌙 Koyu" : "☀️ Açık"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Yanıt stili */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink)]/60 mb-2">
                  Yanıt Stili
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RESPONSE_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => updateConfig({ responseStyle: s.id })}
                      className={`p-3 text-left rounded-xl border transition-colors ${
                        config.responseStyle === s.id
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                          : "border-[var(--color-surface)] hover:bg-[var(--color-surface)]/50"
                      }`}
                    >
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-[11px] text-[var(--color-ink)]/40">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bildirim sesi */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm">Bildirim Sesi</div>
                  <div className="text-[11px] text-[var(--color-ink)]/40">
                    Yanıt gelince ses çal
                  </div>
                </div>
                <button
                  onClick={() => updateConfig({ notificationSound: !config.notificationSound })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    config.notificationSound ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface)]"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      config.notificationSound ? "translate-x-[26px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* ─── GELİŞMİŞ SEKMESİ ─── */}
          {activeTab === "advanced" && (
            <div className="space-y-5">
              {/* Misafir mod */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm">Misafir Mod</div>
                  <div className="text-[11px] text-[var(--color-ink)]/40">
                    Sekme kapanınca API anahtarları silinir
                  </div>
                </div>
                <button className="w-11 h-6 rounded-full bg-[var(--color-surface)] transition-colors relative">
                  <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform translate-x-[2px]" />
                </button>
              </div>

              {/* Yazı tipi boyutu */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink)]/60 mb-2">
                  Yazı Tipi Boyutu: {config.fontSize}px
                </label>
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={config.fontSize}
                  onChange={(e) => updateConfig({ fontSize: Number(e.target.value) })}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>

              {/* Vurgu rengi */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink)]/60 mb-2">
                  Vurgu Rengi
                </label>
                <div className="flex gap-2">
                  {(["amber", "green", "orange"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => updateConfig({ accentColor: c })}
                      className={`w-10 h-10 rounded-full border-2 transition-colors ${
                        config.accentColor === c
                          ? "border-white"
                          : "border-transparent hover:border-white/50"
                      }`}
                      style={{
                        backgroundColor:
                          c === "amber" ? "#f59e0b" : c === "green" ? "#22c55e" : "#f97316",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <hr className="border-[var(--color-surface)]" />

              <p className="text-xs text-[var(--color-ink)]/30">
                WebContainer API, gerçek terminal deneyimi için gereklidir.{" "}
                <a href="https://webcontainers.io" className="underline hover:text-[var(--color-ink)]/50" target="_blank">
                  Daha fazla bilgi
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
