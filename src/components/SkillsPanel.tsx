"use client";

// src/components/SkillsPanel.tsx — Özelleştirilebilir Skills modalı

import { useState } from "react";
import { useStore } from "@/lib/store";
import { X, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { Skill } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SkillsPanel({ open, onClose }: Props) {
  const skills = useStore((s) => s.skills);
  const addSkill = useStore((s) => s.addSkill);
  const removeSkill = useStore((s) => s.removeSkill);
  const toggleSkill = useStore((s) => s.toggleSkill);
  const updateSkill = useStore((s) => s.updateSkill);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleAdd = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const id = `skill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    addSkill({
      id,
      title: newTitle.trim(),
      content: newContent.trim(),
      type: "manual",
      enabled: true,
    });
    setNewTitle("");
    setNewContent("");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Skills paneli"
    >
      <div
        className="w-full max-w-xl max-h-[80vh] bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink">Skills</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bgsoft rounded-lg transition-colors text-muted hover:text-ink"
            title="Kapat"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mevcut skill listesi */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {skills.length === 0 && (
            <p className="text-sm text-muted text-center py-8">
              Henüz bir skill eklenmedi. Aşağıdan yeni skill ekleyin.
            </p>
          )}
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-bgsoft border border-line"
            >
              <button
                onClick={() => toggleSkill(skill.id)}
                className="shrink-0 mt-0.5 text-amber-400 hover:text-amber-300 transition-colors"
                title={skill.enabled ? "Devre dışı bırak" : "Etkinleştir"}
                aria-label={`${skill.title} ${skill.enabled ? "devre dışı bırak" : "etkinleştir"}`}
              >
                {skill.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} className="text-muted" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{skill.title}</p>
                <p className="text-xs text-muted mt-0.5 line-clamp-2">{skill.content}</p>
                <p className="text-[10px] text-muted mt-1">
                  {skill.type === "manual" ? "Manuel" : "Dosya"} · {skill.enabled ? "Aktif" : "Pasif"}
                </p>
              </div>
              <button
                onClick={() => removeSkill(skill.id)}
                className="shrink-0 p-1 hover:bg-red-500/10 hover:text-red-400 rounded text-muted transition-colors"
                title="Sil"
                aria-label={`${skill.title} sil`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Yeni skill ekleme */}
        <div className="border-t border-line p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Yeni Skill Ekle
          </h3>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Skill başlığı..."
            className="w-full px-3 py-2 bg-bgsoft border border-line rounded-xl text-sm text-ink placeholder:text-muted outline-none focus:border-amber-400/50 transition-colors"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Skill içeriği (kural, rehber, bağlam...)"
            rows={3}
            className="w-full px-3 py-2 bg-bgsoft border border-line rounded-xl text-sm text-ink placeholder:text-muted outline-none focus:border-amber-400/50 transition-colors resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim() || !newContent.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
