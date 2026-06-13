"use client";

import { useState } from "react";
import { GitPullRequest, Loader2, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";

export function GitPanel({ onClose, onReviewPr }: { onClose: () => void; onReviewPr?: () => void }) {
  const repo = useStore((s) => s.repo);
  const addToast = useStore((s) => s.addToast);
  const [tab, setTab] = useState<"branch" | "pr">("branch");
  const [branchName, setBranchName] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [prHead, setPrHead] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const getToken = () => useStore.getState().activeGithub()?.token ?? "";

  const createBranch = async () => {
    if (!repo || !branchName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/github/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_branch",
          owner: repo.owner, repo: repo.repo, token: getToken(),
          branchName: branchName.trim(), fromBranch: repo.branch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast(`Dal oluşturuldu: ${branchName}`, "success");
      setResult(branchName.trim());
      setBranchName("");
    } catch (e) { addToast(`Hata: ${(e as Error).message}`, "error"); }
    finally { setLoading(false); }
  };

  const createPR = async () => {
    if (!repo || !prTitle.trim() || !prHead.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/github/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_pr",
          owner: repo.owner, repo: repo.repo, token: getToken(),
          title: prTitle.trim(), body: prBody.trim(),
          head: prHead.trim(), base: repo.branch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast("PR oluşturuldu!", "success");
      window.open(data.url, "_blank");
    } catch (e) { addToast(`Hata: ${(e as Error).message}`, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full h-full flex flex-col bg-surface/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-line/60 shrink-0">
        <span className="text-xs font-bold text-muted/70 uppercase tracking-wide">Git & PR</span>
        <div className="flex items-center gap-1.5">
          {onReviewPr && (
            <button
              onClick={onReviewPr}
              className="flex items-center gap-1 text-[11px] text-brand hover:text-branddim font-semibold transition-colors"
              title="Mevcut bir PR/MR'ı AI ile incele"
            >
              <GitPullRequest size={12} /> İncele
            </button>
          )}
          <button onClick={onClose} className="text-muted/40 hover:text-muted transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="flex gap-1 px-3 py-2 border-b border-line/40 shrink-0">
        {(["branch", "pr"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-[11px] py-1.5 rounded-lg transition-colors ${tab === t ? "bg-brand/10 text-brand font-semibold" : "text-muted hover:text-ink hover:bg-bgsoft"}`}>
            {t === "branch" ? "Dal Oluştur" : "PR Aç"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "branch" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">Mevcut daldan yeni bir dal oluştur: <code className="text-brand">{repo?.branch}</code></p>
            <input value={branchName} onChange={(e) => setBranchName(e.target.value)}
              placeholder="yeni-dal-adi" className="input-mono text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") createBranch(); }} />
            <button onClick={createBranch} disabled={loading || !branchName.trim()}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand hover:bg-branddim text-white text-xs font-semibold disabled:opacity-40 transition-colors">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Dal Oluştur
            </button>
            {result && (
              <div className="text-xs text-green/80 bg-green/5 border border-green/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <span>✓ Dal hazır: <code className="font-mono">{result}</code></span>
                <button
                  onClick={() => {
                    const store = useStore.getState();
                    if (store.repo) store.setRepo({ ...store.repo, branch: result });
                    addToast(`Aktif dal: ${result}`, "success");
                    setResult(null);
                  }}
                  className="ml-auto text-[10px] px-2 py-1 rounded bg-green/10 hover:bg-green/20 transition-colors font-semibold"
                >
                  Geç
                </button>
              </div>
            )}
          </div>
        )}
        {tab === "pr" && (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs text-muted">Base: <code className="text-brand">{repo?.branch}</code></p>
            <input value={prHead} onChange={(e) => setPrHead(e.target.value)}
              placeholder="kaynak-dal (head)" className="input-mono text-xs" />
            <input value={prTitle} onChange={(e) => setPrTitle(e.target.value)}
              placeholder="PR başlığı" className="input-mono text-xs" />
            <textarea value={prBody} onChange={(e) => setPrBody(e.target.value)}
              placeholder="Açıklama (opsiyonel)" rows={3} className="input-mono text-xs resize-none" />
            <button onClick={createPR} disabled={loading || !prTitle.trim() || !prHead.trim()}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand hover:bg-branddim text-white text-xs font-semibold disabled:opacity-40 transition-colors">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <GitPullRequest size={12} />} PR Oluştur
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
