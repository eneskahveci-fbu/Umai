"use client";

import { useState, useEffect } from "react";

interface Skill {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  source?: "manual" | "file";
  fileName?: string;
  enabled: boolean;
}

interface Props {
  skills: Skill[];
  onToggle: (id: string, enabled: boolean) => void;
  onSave: (skill: Skill) => void;
  onDelete: (id: string) => void;
  open?: boolean;
  onClose?: () => void;
}

type TabId = "skills" | "files" | "agents" | "progress";

const BUILTIN_AGENTS = [
  { id: "explain", name: "/explain", description: "Kod veya kavramı açıklar", icon: "📖" },
  { id: "refactor", name: "/refactor", description: "Kodu yeniden düzenler", icon: "🔧" },
  { id: "test", name: "/test", description: "Test kodu yazar", icon: "🧪" },
  { id: "fix", name: "/fix", description: "Hata ayıklar ve düzeltir", icon: "🐛" },
  { id: "review", name: "/review", description: "Kod incelemesi yapar", icon: "👀" },
  { id: "docs", name: "/docs", description: "Dokümantasyon yazar", icon: "📝" },
];

export function SkillsPanel({ skills, onToggle, onSave, onDelete, open: controlledOpen, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("skills");
  const [editing, setEditing] = useState<Skill | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const isControlled = controlledOpen !== undefined;
  const visible = isControlled ? controlledOpen : isOpen;

  const close = () => {
    if (isControlled) onClose?.();
    else setIsOpen(false);
    setEditing(null);
  };

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-skills", handler);
    return () => window.removeEventListener("open-skills", handler);
  }, []);

  if (!visible) return null;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "skills", label: "Skills", count: skills.filter((s) => s.source !== "file").length },
    { id: "files", label: "Dosyalar", count: skills.filter((s) => s.source === "file").length },
    { id: "agents", label: "Agents", count: BUILTIN_AGENTS.length },
    { id: "progress", label: "İlerleme" },
  ];

  const handleSaveNew = () => {
    if (!title.trim()) return;
    onSave({
      id: `skill-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      source: "manual",
      enabled: true,
    });
    setTitle("");
    setContent("");
    setEditing(null);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-2xl max-h-[80vh] bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Başlık ve sekmeler */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-surface)]">
          <h2 className="text-lg font-semibold">⚡ Skills &amp; Özelleştirme</h2>
          <button onClick={close} className="text-[var(--color-ink)]/40 hover:text-[var(--color-ink)] transition-colors text-lg">
            ✕
          </button>
        </div>

        <div className="flex border-b border-[var(--color-surface)] px-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                activeTab === t.id
                  ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                  : "border-transparent text-[var(--color-ink)]/50 hover:text-[var(--color-ink)]/70"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "skills" && (
            <div className="space-y-3">
              {editing && (
                <div className="p-4 border border-[var(--color-brand)]/30 rounded-xl bg-[var(--color-surface)]/50">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Skill başlığı"
                    className="w-full bg-transparent border-b border-[var(--color-surface)] pb-2 mb-3 outline-none text-sm"
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Skill içeriği (markdown)"
                    rows={5}
                    className="w-full bg-transparent border-b border-[var(--color-surface)] pb-2 mb-3 outline-none text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNew}
                      className="px-4 py-1.5 text-xs rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-4 py-1.5 text-xs rounded-lg border border-[var(--color-surface)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {!editing && (
                <button
                  onClick={() => setEditing({ id: "", title: "", content: "", enabled: true })}
                  className="w-full py-3 text-sm border border-dashed border-[var(--color-surface)] rounded-xl hover:border-[var(--color-brand)]/30 hover:bg-[var(--color-brand)]/5 transition-all"
                >
                  + Yeni Skill Ekle
                </button>
              )}

              {skills
                .filter((s) => s.source !== "file")
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface)]/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => onToggle(s.id, e.target.checked)}
                      className="mt-1 accent-[var(--color-brand)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-xs text-[var(--color-ink)]/40 line-clamp-2 mt-0.5">
                        {s.content.slice(0, 120)}
                      </div>
                      {s.tags && s.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {s.tags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-ink)]/40">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onDelete(s.id)}
                      className="text-xs text-[var(--color-ink)]/30 hover:text-red-400 transition-colors"
                      title="Sil"
                    >
                      🗑
                    </button>
                  </div>
                ))}

              {skills.filter((s) => s.source !== "file").length === 0 && !editing && (
                <p className="text-center text-sm text-[var(--color-ink)]/40 py-8">
                  Henüz manuel skill eklenmemiş
                </p>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-3">
              {skills
                .filter((s) => s.source === "file")
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface)]/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => onToggle(s.id, e.target.checked)}
                      className="mt-1 accent-[var(--color-brand)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">📄 {s.fileName || s.title}</div>
                      <div className="text-xs text-[var(--color-ink)]/40 line-clamp-2 mt-0.5">
                        {s.content.slice(0, 120)}
                      </div>
                    </div>
                  </div>
                ))}
              {skills.filter((s) => s.source === "file").length === 0 && (
                <p className="text-center text-sm text-[var(--color-ink)]/40 py-8">
                  Henüz dosya eklenmemiş
                </p>
              )}
            </div>
          )}

          {activeTab === "agents" && (
            <div className="grid grid-cols-2 gap-2">
              {BUILTIN_AGENTS.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface)]/30"
                >
                  <span className="text-lg">{a.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-[var(--color-ink)]/40">{a.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "progress" && (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">📊</div>
              <p className="text-sm text-[var(--color-ink)]/60">
                Kullanım istatistikleri yakında burada görünecek.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
