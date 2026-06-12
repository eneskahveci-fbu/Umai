"use client";

import { X, Plus, GripVertical, ToggleLeft, ToggleRight, Trash2, FileText, User Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Skill } from "@/lib/types";

export function SkillsPanel() {
  const open = useStore((s) => s.libraryOpen);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);
  const skills = useStore((s) => s.skills);
  const addSkill = useStore((s) => s.addSkill);
  const toggleSkill = useStore((s) => s.toggleSkill);
  const removeSkill = useStore((s) => s.removeSkill);

  const [tab, setTab] = useState<"manual" | "file">("manual");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLibraryOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setLibraryOpen]);

  const handleAddManual = () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    const skill: Skill = {
      id: `manual_${Date.now()}`,
      title: t,
      content: c,
      source: "manual",
      enabled: true,
    };
    addSkill(skill);
    setTitle("");
    setContent("");
    titleRef.current?.focus();
  };

  const manualSkills = skills.filter((s) => s.source === "manual");
  const fileSkills = skills.filter((s) => s.source === "file");
  const currentSkills = tab === "manual" ? manualSkills : fileSkills;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setLibraryOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Skills Yönetimi"
    >
      <div className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold">Skills Yönetimi</h2>
          <button
            onClick={() => setLibraryOpen(false)}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors"
            aria-label="Kapat"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
          <button
            onClick={() => setTab("manual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "manual" ? "bg-amber-400 text-black" : "bg-bgsoft text-muted hover:text-ink"
            }`}
          >
            <UserPlus size={12} />
            Manuel
          </button>
          <button
            onClick={() => setTab("file")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "file" ? "bg-amber-400 text-black" : "bg-bgsoft text-muted hover:text-ink"
            }`}
          >
            <FileText size={12} />
            Dosya
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Manual add form */}
          {tab === "manual" && (
            <div className="space-y-2.5 pb-3 border-b border-line/50">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Skill başlığı..."
                className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Skill içeriği (sistem prompt'una eklenecek)..."
                rows={3}
                className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50 transition-colors resize-none"
              />
              <button
                onClick={handleAddManual}
                disabled={!title.trim() || !content.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-400 text-black hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                Ekle
              </button>
            </div>
          )}

          {/* File skills info */}
          {tab === "file" && fileSkills.length === 0 && (
            <p className="text-sm text-muted text-center py-8">
              Henüz dosya tabanlı skill eklenmedi. Ayarlar → Dosyalar sekmesinden ekleyebilirsiniz.
            </p>
          )}

          {/* Skill listesi */}
          {currentSkills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-bgsoft/50 border border-line/30 group hover:border-line/60 transition-colors"
            >
              <GripVertical size={13} className="text-muted/40 mt-0.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-100" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{skill.title}</span>
                  {skill.fileName && (
                    <span className="text-[10px] font-mono text-muted truncate">({skill.fileName})</span>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{skill.content.slice(0, 120)}</p>
              </div>
              <button
                onClick={() => toggleSkill(skill.id)}
                className="shrink-0 text-muted hover:text-ink transition-colors"
                title={skill.enabled ? "Devre dışı bırak" : "Etkinleştir"}
              >
                {skill.enabled ? <ToggleRight size={18} className="text-amber-400" /> : <ToggleLeft size={18} />}
              </button>
              <button
                onClick={() => removeSkill(skill.id)}
                className="shrink-0 text-muted/40 hover:text-red-400 transition-colors"
                title="Sil"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
