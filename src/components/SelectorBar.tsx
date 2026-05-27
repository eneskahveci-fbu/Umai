"use client";

import { Boxes, GitBranch, FolderGit2, Plus } from "lucide-react";
import { useStore } from "@/lib/store";

/** Model · GitHub hesabı · Repo seçici. Hem Sohbet hem Coder üst barında kullanılır. */
export function SelectorBar() {
  const config = useStore((s) => s.config);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const setActiveGithub = useStore((s) => s.setActiveGithub);
  const setActiveRepo = useStore((s) => s.setActiveRepo);
  const addRepo = useStore((s) => s.addRepo);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* MODEL */}
      {config.models.length > 0 ? (
        <Pill icon={<Boxes size={13} />}>
          <select
            value={config.activeModelId ?? ""}
            onChange={(e) => setActiveModel(e.target.value)}
            className="bare-select"
          >
            {config.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label || m.model}
              </option>
            ))}
          </select>
        </Pill>
      ) : (
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-brand/50 text-brand hover:bg-brand/10"
        >
          <Plus size={13} /> Model ekle
        </button>
      )}

      {/* GITHUB HESABI */}
      <Pill icon={<GitBranch size={13} />}>
        <select
          value={config.activeGithubId ?? ""}
          onChange={(e) => setActiveGithub(e.target.value || null)}
          className="bare-select"
        >
          <option value="">Genel (public)</option>
          {config.githubAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username}
            </option>
          ))}
        </select>
      </Pill>

      {/* REPO */}
      <Pill icon={<FolderGit2 size={13} />}>
        <select
          value={config.activeRepo ?? ""}
          onChange={(e) => {
            if (e.target.value === "__add__") {
              const v = window.prompt("Depo (kullanici/depo):");
              if (v) {
                const clean = v.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
                const valid = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(clean);
                if (valid) addRepo(clean);
                else useStore.getState().addToast("Geçersiz depo formatı. Örn: kullanici/depo", "error");
              }
            } else {
              setActiveRepo(e.target.value);
            }
          }}
          className="bare-select max-w-[180px]"
        >
          {config.repos.length === 0 && <option value="">depo yok</option>}
          {config.repos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="__add__">+ Depo ekle…</option>
        </select>
      </Pill>
    </div>
  );
}

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-bgsoft text-xs text-muted">
      <span className="text-brand">{icon}</span>
      {children}
    </div>
  );
}
