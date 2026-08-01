"use client";

import { Boxes, GitBranch, FolderGit2, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseRepo, splitRepoBranch } from "@/lib/github";
import { isGitLabRepo, parseGitLabRepo } from "@/lib/gitlab";

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
              const v = window.prompt("Depo (kullanici/depo veya gitlab.com/grup/depo):");
              if (v) {
                /* GitLab depoları buradan EKLENEMİYORDU: eski doğrulama yalnız
                   `github.com/` önekini soyup tek eğik çizgili `sahip/depo`
                   deseni arıyordu — "gitlab.com/grup/alt-grup/depo" hem fazladan
                   eğik çizgi hem de nokta içerdiği için "Geçersiz depo formatı"
                   ile reddediliyordu. Artık sağlayıcıya göre GERÇEK ayrıştırıcı
                   kullanılıyor (Ayarlar'daki alanla aynı davranış) ve ":dal"
                   soneki de korunuyor. */
                const raw = v.trim().replace(/\/$/, "");
                const { repoStr, branch } = splitRepoBranch(raw);
                let parsed: string | null = null;
                if (isGitLabRepo(repoStr)) {
                  const gl = parseGitLabRepo(repoStr);
                  if (gl) parsed = `gitlab.com/${gl.namespace}/${gl.repo}`;
                } else {
                  const gh = parseRepo(repoStr);
                  if (gh) parsed = `${gh.owner}/${gh.repo}`;
                }
                if (parsed) addRepo(branch ? `${parsed}:${branch}` : parsed);
                else useStore.getState().addToast("Geçersiz depo. Örn: kullanici/depo veya gitlab.com/grup/depo", "error");
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
