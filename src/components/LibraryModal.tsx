"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Project } from "@/lib/types";
import { X, Plus, FolderGit2, Trash2, Check } from "lucide-react";

export function LibraryModal() {
  const open = useStore((s) => s.libraryOpen);
  const setOpen = useStore((s) => s.setLibraryOpen);
  const projects = useStore((s) => s.projects);
  const addProject = useStore((s) => s.addProject);
  const removeProject = useStore((s) => s.removeProject);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [provider, setProvider] = useState<"github" | "gitlab">("github");
  const [token, setToken] = useState("");

  if (!open) return null;

  const handleAdd = () => {
    if (!name.trim() || !owner.trim() || !repoName.trim()) return;

    const project: Project = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: name.trim(),
      repo: {
        owner: owner.trim(),
        repo: repoName.trim(),
        branch: branch.trim() || "main",
      },
      gitAccountId: provider,
    };

    addProject(project);
    setName("");
    setOwner("");
    setRepoName("");
    setBranch("main");
    setToken("");
    setShowForm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-bg/80 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Proje kütüphanesi"
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <FolderGit2 size={18} className="text-amber-400" />
            <h3 className="font-semibold">Projeler</h3>
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

        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
          {/* Proje listesi */}
          {projects.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer group ${
                activeProjectId === p.id
                  ? "border-amber-400/50 bg-amber-400/10"
                  : "border-line hover:bg-bgsoft"
              }`}
              onClick={() => setActiveProject(p.id === activeProjectId ? null : p.id)}
            >
              <FolderGit2 size={16} className="text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted truncate">
                  {p.repoOwner}/{p.repoName}
                </p>
              </div>
              {activeProjectId === p.id && (
                <Check size={14} className="text-amber-400 shrink-0" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject(p.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all p-0.5 shrink-0"
                title="Sil"
                aria-label={`${p.name} projesini sil`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {projects.length === 0 && !showForm && (
            <p className="text-sm text-muted text-center py-6">
              Henüz proje yok. Yeni bir repo bağlantısı ekleyin.
            </p>
          )}

          {/* Ekleme formu */}
          {showForm && (
            <div className="space-y-2 p-3 rounded-xl border border-line bg-bgsoft/50">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proje adı (örn: Kişisel Blog)"
                className="w-full bg-bgsoft border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="Kullanıcı adı"
                  className="flex-1 bg-bgsoft border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
                />
                <span className="text-muted self-center">/</span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Repo"
                  className="flex-1 bg-bgsoft border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Dal (main)"
                  className="flex-1 bg-bgsoft border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
                />
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "github" | "gitlab")}
                  className="bg-bgsoft border border-line rounded-xl px-2 py-2 text-sm outline-none"
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                </select>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token (opsiyonel, sadece tarayıcıda saklanır)"
                className="w-full bg-bgsoft border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2 bg-amber-400 text-black rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={14} />
                  Ekle
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-line rounded-xl text-sm hover:bg-bgsoft transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Ekle butonu */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 border border-dashed border-line rounded-xl text-sm text-muted hover:text-ink hover:bg-bgsoft transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Yeni Proje Bağla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
