"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Skill } from "@/lib/types";
import { X, Plus, Zap, FileText, Bot, BarChart3, Trash2 } from "lucide-react";

type TabId = "skills" | "files" | "agents" | "progress";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "skills", label: "Skills", icon: <Zap size={14} /> },
  { id: "files", label: "Dosyalar", icon: <FileText size={14} /> },
  { id: "agents", label: "Agents", icon: <Bot size={14} /> },
  { id: "progress", label: "İlerleme", icon: <BarChart3 size={14} /> },
];

const DEFAULT_FILE_SKILLS = [
  "TypeScript Kuralları",
  "Next.js/React Pratikleri",
  "Tailwind/UI Tutarlılığı",
  "Güvenlik & Gizlilik",
  "Yanıt Formatı",
  "Claude Code Akışı",
  "Bağlam/CLAUDE.md",
  "Araç Kullanımı",
  "Git Commit Hijyeni",
  "Test & Doğrulama",
];

const BUILTIN_AGENTS = [
  { id: "explain", name: "/explain", desc: "Kodu açıkla" },
  { id: "refactor", name: "/refactor", desc: "Yeniden düzenle" },
  { id: "test", name: "/test", desc: "Test yaz" },
  { id: "fix", name: "/fix", desc: "Hata ayıkla" },
  { id: "review", name: "/review", desc: "Kod incele" },
  { id: "docs", name: "/docs", desc: "Dokümantasyon" },
];

export function SkillsPanel() {
  const open = useStore((s) => s.skillsPanelOpen);
  const setOpen = useStore((s) => s.setSkillsPanelOpen);
  const skills = useStore((s) => s.skills);
  const toggleSkill = useStore((s) => s.toggleSkill);
  const addSkill = useStore((s) => s.addSkill);
  const removeSkill = useStore((s) => s.removeSkill);

  const [activeTab, setActiveTab] = useState<TabId>("skills");
  const [newSkillText, setNewSkillText] = useState("");

  if (!open) return null;

  const handleAddManual = () => {
    const text = newSkillText.trim();
    if (!text) return;
    const title = text.slice(0, 60);
    addSkill({
      title,
      content: text,
      source: "manual",
      tags: [],
      enabled: true,
    });
    setNewSkillText("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-bg/80 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Skills & Ayarlar"
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-semibold">Customize Skills</h3>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="hover:bg-bgsoft rounded-lg p-1 transition-colors"
            title="Kapat"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line px-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto p-4">
          {activeTab === "skills" && (
            <div className="space-y-3">
              {/* Yeni skill ekleme */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
                  placeholder="Yeni skill kuralı yaz..."
                  className="flex-1 bg-bgsoft border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50 transition-colors"
                />
                <button
                  onClick={handleAddManual}
                  className="px-3 py-2 bg-amber-400 text-black rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors flex items-center gap-1"
                >
                  <Plus size={14} />
                  Ekle
                </button>
              </div>

              {/* Manuel skill'ler */}
              {skills
                .filter((s) => s.source === "manual")
                .map((s) => (
                  <SkillCard
                    key={s.title}
                    skill={s}
                    onToggle={() => toggleSkill(s.title)}
                    onDelete={() => removeSkill(s.title)}
                  />
                ))}

              {skills.filter((s) => s.source === "manual").length === 0 && (
                <p className="text-sm text-muted text-center py-4">
                  Henüz manuel skill yok. Yukarıdan ekleyin.
                </p>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-2">
              <p className="text-xs text-muted mb-3">
                Varsayılan referans dosyaları. Aktif olanlar sistem prompt&apos;una eklenir.
              </p>
              {DEFAULT_FILE_SKILLS.map((name) => {
                const existing = skills.find((s) => s.title === name && s.source === "file");
                const enabled = existing ? existing.enabled : true;
                return (
                  <div
                    key={name}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bgsoft transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => {
                        if (existing) {
                          toggleSkill(name);
                        } else {
                          addSkill({
                            title: name,
                            content: `# ${name}\nVarsayılan referans dosyası.`,
                            source: "file",
                            fileName: name.toLowerCase().replace(/\s+/g, "-") + ".md",
                            tags: [],
                            enabled: false, // toggle edince true olacak
                          });
                        }
                      }}
                      className="rounded accent-amber-400"
                    />
                    <FileText size={14} className="text-muted" />
                    <span className="text-sm">{name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "agents" && (
            <div className="space-y-2">
              <p className="text-xs text-muted mb-3">
                Sohbette &quot;/&quot; ile tetiklenen yerleşik komutlar.
              </p>
              {BUILTIN_AGENTS.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-bgsoft transition-colors"
                >
                  <Bot size={14} className="text-amber-400" />
                  <span className="text-sm font-mono">{a.name}</span>
                  <span className="text-xs text-muted">— {a.desc}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "progress" && (
            <div className="text-center py-8">
              <BarChart3 size={32} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">
                Kullanım istatistikleriniz burada görünecek.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onToggle,
  onDelete,
}: {
  skill: Skill;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl border border-line bg-bgsoft/50 hover:bg-bgsoft transition-colors group">
      <input
        type="checkbox"
        checked={skill.enabled}
        onChange={onToggle}
        className="mt-1 rounded accent-amber-400"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{skill.title}</p>
        <p className="text-xs text-muted line-clamp-2 mt-0.5">{skill.content}</p>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all p-0.5"
        title="Sil"
        aria-label="Sil"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
