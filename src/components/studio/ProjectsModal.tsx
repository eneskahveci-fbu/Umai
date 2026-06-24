"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { designSystemById } from "@/lib/designSystems";
import type { StudioProject } from "@/lib/types";

/* Stüdyo projeleri — kaydedilen tasarımlar (config.studioProjects, user_config ile
   senkron). Aç, yeniden adlandır, sil. */
export function ProjectsModal({
  onOpen,
  onClose,
}: {
  onOpen: (p: StudioProject) => void;
  onClose: () => void;
}) {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const projects = (config.studioProjects ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const remove = (id: string) => saveConfig({ ...config, studioProjects: (config.studioProjects ?? []).filter((p) => p.id !== id) });
  const commitRename = (id: string) => {
    const name = renameVal.trim();
    if (name) saveConfig({ ...config, studioProjects: (config.studioProjects ?? []).map((p) => (p.id === id ? { ...p, name } : p)) });
    setRenaming(null);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 grid place-items-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl w-full max-w-2xl h-[78vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
          <h2 className="text-sm font-bold">Projelerim <span className="text-muted/60 font-normal">({projects.length})</span></h2>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-3">
          {projects.length === 0 ? (
            <div className="h-full grid place-items-center text-center text-muted text-sm px-6">
              Henüz kayıtlı proje yok.<br />Bir tasarım üret, sonra workspace’te “Kaydet”e bas.
            </div>
          ) : (
            <div className="space-y-1.5">
              {projects.map((p) => {
                const ds = designSystemById(config, p.designSystemId);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-line bg-bgsoft/40 hover:border-brand/40 transition-colors group">
                    <span className="w-9 h-9 rounded-lg shrink-0 border border-line/50" style={{ background: ds ? `linear-gradient(135deg, ${ds.accent}, ${ds.accent}22)` : "var(--color-bgsoft)" }} />
                    <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left">
                      {renaming === p.id ? (
                        <input
                          autoFocus value={renameVal}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(p.id); if (e.key === "Escape") setRenaming(null); }}
                          onBlur={() => commitRename(p.id)}
                          className="w-full bg-bg border border-line rounded px-2 py-1 text-sm outline-none focus:border-brand"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-ink truncate group-hover:text-brand transition-colors">{p.name}</div>
                      )}
                      <div className="text-[11px] text-muted/70 truncate">{p.brief}</div>
                    </button>
                    <span className="text-[10px] text-muted/50 shrink-0 hidden sm:block">{new Date(p.updatedAt).toLocaleDateString("tr-TR")}</span>
                    <button onClick={() => { setRenaming(p.id); setRenameVal(p.name); }} className="shrink-0 text-muted/50 hover:text-ink p-1" title="Yeniden adlandır">{renaming === p.id ? <Check size={13} /> : <Pencil size={13} />}</button>
                    <button onClick={() => remove(p.id)} className="shrink-0 text-muted/50 hover:text-red p-1" title="Sil"><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
