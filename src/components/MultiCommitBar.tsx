"use client";

import { useEffect, useState } from "react";
import { Check, FileText, FolderOpen, GitCommit, Loader2, Terminal, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { EditorFile } from "@/lib/editor";
import { getMountedHandle, getMountedName, writeBackToDir } from "@/lib/localfs";
import { getWebContainer, isSupported as wcSupported, needsApiKey, writeFile as wcWriteFile } from "@/lib/webcontainer";
import { isGitLabRepo } from "@/lib/gitlab";

export function MultiCommitBar({
  files,
  onClose,
  onOpenInEditor,
}: {
  files: EditorFile[];
  onClose: () => void;
  onOpenInEditor: (f: EditorFile) => void;
}) {
  const repo = useStore((s) => s.repo);
  const addToast = useStore((s) => s.addToast);
  const apiKey = useStore((s) => s.config.webcontainerApiKey);
  const [selected, setSelected] = useState<Set<string>>(new Set(files.map((f) => f.path)));
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [writingLocal, setWritingLocal] = useState(false);
  const [writingSandbox, setWritingSandbox] = useState(false);
  const [done, setDone] = useState(false);
  const [mountedName, setMountedName] = useState<string | null>(getMountedName());

  useEffect(() => {
    const fn = () => setMountedName(getMountedName());
    window.addEventListener("localfs:changed", fn);
    return () => window.removeEventListener("localfs:changed", fn);
  }, []);

  if (files.length === 0) return null;
  const toCommit = files.filter((f) => selected.has(f.path));

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path); else next.add(path);
    setSelected(next);
  };

  const writeLocal = async () => {
    const handle = getMountedHandle();
    if (!handle) { addToast("Yerel klasör mount edilmemiş", "error"); return; }
    if (toCommit.length === 0) return;
    setWritingLocal(true);
    try {
      let ok = 0;
      for (const f of toCommit) {
        await writeBackToDir(handle, f.path, f.content);
        ok++;
      }
      addToast(`✓ ${ok} dosya yerel klasöre yazıldı`, "success");
    } catch (e) {
      addToast(`Yerel yazma hatası: ${(e as Error).message}`, "error");
    } finally {
      setWritingLocal(false);
    }
  };

  const writeSandbox = async () => {
    if (!wcSupported()) { addToast("Tarayıcı sandbox'ı desteklemiyor", "error"); return; }
    if (needsApiKey() && !apiKey.trim()) { addToast("Sandbox API key gerekli (Ayarlar → Gelişmiş)", "error"); return; }
    if (toCommit.length === 0) return;
    setWritingSandbox(true);
    try {
      const wc = await getWebContainer(apiKey);
      for (const f of toCommit) await wcWriteFile(wc, f.path, f.content);
      addToast(`✓ ${toCommit.length} dosya sandbox FS'sine yazıldı`, "success");
    } catch (e) {
      addToast(`Sandbox yazma hatası: ${(e as Error).message}`, "error");
    } finally {
      setWritingSandbox(false);
    }
  };

  const commit = async () => {
    if (!repo) { addToast("Depo bağlı değil", "error"); return; }
    if (toCommit.length === 0) { addToast("Hiç dosya seçilmedi", "error"); return; }
    const store = useStore.getState();
    const activeRepo = store.config.activeRepo || "";
    const gitLab = isGitLabRepo(activeRepo);
    const commitMsg = message.trim() || `Update ${toCommit.length} files`;

    setCommitting(true);
    try {
      if (gitLab) {
        const activeGitlab = store.activeGitlab();
        if (!activeGitlab || !activeGitlab.token) throw new Error("GitLab token yok — Ayarlar → Depolar'dan ekle");
        // GitLab: commit her dosyayı tek tek
        for (const f of toCommit) {
          const res = await fetch("/api/gitlab/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              namespace: repo.owner,
              repo: repo.repo,
              branch: repo.branch,
              path: f.path,
              content: f.content,
              message: commitMsg,
              token: activeGitlab.token,
            }),
          });
          if (!res.ok) {
            const { error } = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
            throw new Error(error);
          }
        }
        addToast(`✓ ${toCommit.length} dosya GitLab'a commit'lendi`, "success");
      } else {
        const activeGithub = store.activeGithub();
        if (!activeGithub || !activeGithub.token) throw new Error("GitHub token yok — Ayarlar → Depolar'dan ekle");
        const res = await fetch("/api/github/batch-write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            branch: repo.branch,
            message: commitMsg,
            token: activeGithub.token,
            files: toCommit.map((f) => ({ path: f.path, content: f.content })),
          }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
          throw new Error(error);
        }
        const { sha } = await res.json();
        addToast(`✓ ${toCommit.length} dosya commit'lendi (${sha.slice(0, 7)})`, "success");
      }
      setDone(true);
      setTimeout(onClose, 2000);
    } catch (e) {
      addToast(`Commit hatası: ${(e as Error).message}`, "error");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="mt-3 border border-brand/30 rounded-xl bg-brand/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-brand/10 border-b border-brand/20">
        <GitCommit size={13} className="text-brand" />
        <span className="text-xs font-semibold text-brand">
          {files.length} dosya bulundu — {toCommit.length} seçili
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="text-muted hover:text-ink w-7 h-7 grid place-items-center rounded-lg hover:bg-bgsoft transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <div className="max-h-44 overflow-y-auto px-2 py-1">
        {files.map((f) => (
          <div
            key={f.path}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bgsoft/40 transition-colors group/file"
          >
            <button
              onClick={() => toggle(f.path)}
              className={`w-3.5 h-3.5 rounded border shrink-0 grid place-items-center transition-colors ${
                selected.has(f.path) ? "bg-brand border-brand" : "border-line hover:border-muted"
              }`}
            >
              {selected.has(f.path) && <Check size={9} className="text-white" />}
            </button>
            <FileText size={12} className="text-muted/50 shrink-0" />
            <button
              onClick={() => onOpenInEditor(f)}
              className="flex-1 min-w-0 text-left text-[11px] font-mono text-muted hover:text-ink truncate transition-colors"
              title="Editörde aç"
            >
              {f.path}
            </button>
            <span className="text-[10px] text-muted/40 shrink-0">{f.content.split("\n").length} satır</span>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-brand/20 flex items-center gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Update ${toCommit.length} files`}
          disabled={committing || done}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          className="flex-1 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 disabled:opacity-50"
        />

        {mountedName && (
          <button
            onClick={writeLocal}
            disabled={writingLocal || toCommit.length === 0}
            title={`${mountedName} klasörüne yaz`}
            className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg bg-green/15 hover:bg-green/25 text-green/90 font-semibold disabled:opacity-50 transition-colors"
          >
            {writingLocal ? <Loader2 size={11} className="animate-spin" /> : <FolderOpen size={11} />}
            Yerel
          </button>
        )}

        <button
          onClick={writeSandbox}
          disabled={writingSandbox || toCommit.length === 0}
          title="WebContainer (sandbox) FS'sine yaz"
          className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-400/90 font-semibold disabled:opacity-50 transition-colors"
        >
          {writingSandbox ? <Loader2 size={11} className="animate-spin" /> : <Terminal size={11} />}
          Sandbox
        </button>

        <button
          onClick={commit}
          disabled={committing || done || toCommit.length === 0}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand hover:bg-branddim text-white font-semibold disabled:opacity-50 transition-colors"
        >
          {done ? <Check size={12} /> : committing ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />}
          {done ? "Tamam" : committing ? `${toCommit.length}…` : `${toCommit.length} commit`}
        </button>
      </div>
    </div>
  );
}
