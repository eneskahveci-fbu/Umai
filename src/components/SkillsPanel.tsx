"use client";

import { useRef, useState } from "react";
import { Check, FileUp, Pencil, Plus, Trash2, X, Zap } from "lucide-react";
import { useStore } from "@/lib/store";

export function SkillsPanel() {
  const open = useStore((s) => s.skillsOpen);
  const setOpen = useStore((s) => s.setSkillsOpen);
  const memories = useStore((s) => s.config.memories);
  const addMemory = useStore((s) => s.addMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const editMemory = useStore((s) => s.editMemory);
  const addToast = useStore((s) => s.addToast);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    addMemory(text);
    setDraft("");
    addToast("Skill eklendi", "success");
  };

  const commitEdit = (id: string) => {
    const text = editDraft.trim();
    if (text) editMemory(id, text);
    setEditingId(null);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = (reader.result as string).slice(0, 4000).trim();
      if (!content) return;
      addMemory(`[${file.name}]\n${content}`);
      addToast(`${file.name} içeri aktarıldı`, "success");
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-[55] bg-bg/80 backdrop-blur-sm grid place-items-center px-4 animate-modal-bg"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 grid place-items-center">
              <Zap size={14} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Skills</h2>
              <p className="text-[11px] text-muted/50 leading-tight">Her sohbete otomatik eklenen bağlam</p>
            </div>
            <span className="text-[11px] text-muted/50 font-mono">{memories.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-bgsoft border border-line/60 text-muted hover:text-ink transition-colors"
            >
              <FileUp size={12} />
              Dosya içeri aktar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.ts,.tsx,.js,.jsx,.py,.json,.yaml,.yml,.env.example"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); e.target.value = ""; }}
            />
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Add new */}
        <div className="px-5 py-3 border-b border-line/40 shrink-0">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }}
              placeholder="Yeni skill ekle — örn. 'TypeScript strict mode kullan', 'Türkçe yorum yaz'… (Ctrl+Enter)"
              rows={2}
              className="flex-1 bg-bgsoft/60 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 ring-amber-400/40 placeholder:text-muted/35 resize-none"
            />
            <button
              onClick={save}
              disabled={!draft.trim()}
              className="shrink-0 w-9 h-9 mt-auto rounded-xl bg-amber-400 hover:bg-amber-300 text-black grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Ekle (Ctrl+Enter)"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {memories.length === 0 ? (
            <div className="text-center py-14">
              <Zap size={28} className="mx-auto mb-3 text-muted/15" />
              <p className="text-sm text-muted/40">Henüz skill eklemedin.</p>
              <p className="text-xs text-muted/30 mt-1">AI her sohbette bunları bağlam olarak kullanacak.</p>
            </div>
          ) : (
            memories.map((m) => (
              <div
                key={m.id}
                className="bg-bgsoft/40 border border-line/60 rounded-xl px-3 py-2.5 flex items-start gap-2 group"
              >
                <Zap size={12} className="text-amber-400/60 mt-0.5 shrink-0" />
                {editingId === m.id ? (
                  <div className="flex-1 flex gap-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitEdit(m.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 bg-bgsoft rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 ring-amber-400/40 resize-none"
                      rows={2}
                      autoFocus
                    />
                    <button onClick={() => commitEdit(m.id)} className="text-green hover:text-green/80 p-1 transition-colors" title="Kaydet"><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted/50 hover:text-muted p-1 transition-colors" title="İptal"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-xs text-muted/80 leading-relaxed whitespace-pre-wrap break-words">{m.content}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingId(m.id); setEditDraft(m.content); }}
                        className="text-muted/50 hover:text-ink p-1 rounded transition-colors"
                        title="Düzenle"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => removeMemory(m.id)}
                        className="text-muted/50 hover:text-red p-1 rounded transition-colors"
                        title="Sil"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        {memories.length > 0 && (
          <div className="px-5 py-2.5 border-t border-line/40 shrink-0">
            <p className="text-[11px] text-muted/40">
              Bu {memories.length} skill her yeni sohbetin sistem prompt'una eklenir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
