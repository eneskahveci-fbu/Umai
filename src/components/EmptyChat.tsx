"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, FolderGit2, GitBranch, History, Plus, Server } from "lucide-react";
import { useStore } from "@/lib/store";

/* "owner/repo:dal" ya da "gitlab.com/grup/alt/repo" → kısa ad. */
function shortRepo(r: string): string {
  return r.split(":")[0].replace(/^gitlab\.com\//, "").split("/").slice(-2).join("/");
}

/* Boş oturum ekranı — Claude Code tarzı "proje önde" (Eyl 2026 kullanıcı
   kararı): bağlı bir depo varsa onun adıyla karşılar; yoksa depo seç/bağla
   kartlarını gösterir. Projesiz sohbet her zaman mümkün — composer'a yazmak
   yeterli ("asla ödeme yapmadan" vaadi: hiçbir ön koşul yok). */
export function EmptyChat() {
  const router = useRouter();
  const chats = useStore((s) => s.chats);
  const selectChat = useStore((s) => s.selectChat);
  const repo = useStore((s) => s.repo);
  const repos = useStore((s) => s.config.repos);
  const setActiveRepo = useStore((s) => s.setActiveRepo);
  const localMode = useStore((s) => s.config.localMode);
  const localBridgeUrl = useStore((s) => s.config.localBridgeUrl);
  const localActive = !!(localMode && localBridgeUrl?.trim());
  /* Son (gizli olmayan) oturum — "kaldığın yerden devam" ince bağlantısı için. */
  const lastChat = chats.find((c) => !c.incognito && c.messages.length > 0);

  const card =
    "flex items-center gap-3 w-full px-3.5 py-3 rounded-xl border border-line/70 bg-surface/60 hover:border-brand/40 hover:bg-bgsoft/70 text-left transition-colors";

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10">
      {repo ? (
        <>
          <div className="inline-flex items-center gap-1.5 text-[12px] font-mono text-muted/80 mb-3 px-2.5 py-1 rounded-lg border border-line/60 bg-surface/50">
            <FolderGit2 size={13} className="text-brand/80" />
            {repo.owner}/{repo.repo}
            {repo.branch && (
              <>
                <GitBranch size={11} className="text-muted/50 ml-1" />
                <span className="text-muted/60">{repo.branch}</span>
              </>
            )}
          </div>
          <h2 className="text-[26px] sm:text-[28px] font-extrabold tracking-tight mb-2 text-center text-balance">Bu projede ne yapalım?</h2>
          <p className="text-sm text-muted/70 max-w-md text-center leading-relaxed">
            Ajan dosyaları okur, düzenler, testleri çalıştırır; değişiklikleri sen onaylarsın.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-[26px] sm:text-[28px] font-extrabold tracking-tight mb-2 text-center text-balance">Ne üzerinde çalışalım?</h2>
          <p className="text-sm text-muted/70 max-w-md text-center leading-relaxed mb-6">
            Bir proje seç ya da doğrudan aşağıya yazıp projesiz sohbet et.
          </p>
          <div className="w-full max-w-md space-y-2">
            {repos.slice(0, 4).map((r) => (
              <button key={r} onClick={() => setActiveRepo(r)} className={card} title={r}>
                <FolderGit2 size={16} className="text-brand/80 shrink-0" />
                <span className="flex-1 min-w-0 truncate font-mono text-[13px]">{shortRepo(r)}</span>
                <ArrowRight size={13} className="text-muted/40 shrink-0" />
              </button>
            ))}
            <button onClick={() => router.push("/settings?tab=github")} className={card}>
              <Plus size={16} className="text-brand/80 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold">Repo bağla</span>
                <span className="block text-[11.5px] text-muted/70">GitHub ya da GitLab deposu — ajan dosyalarda çalışır</span>
              </span>
            </button>
            {!localActive && (
              <button onClick={() => router.push("/settings?tab=advanced")} className={card}>
                <Server size={16} className="text-brand/80 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold">Kendi sunucunu bağla</span>
                  <span className="block text-[11.5px] text-muted/70">Gerçek terminal + dosya sistemi (Oracle Always Free, ücretsiz)</span>
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {lastChat && (
        <button
          onClick={() => selectChat(lastChat.id)}
          className="group mt-6 inline-flex items-center gap-1.5 text-xs text-muted/70 hover:text-ink transition-colors"
        >
          <History size={13} className="text-brand/70" />
          Kaldığın yerden devam: <span className="font-semibold text-ink/80 max-w-[220px] truncate">{lastChat.title}</span>
          <ArrowRight size={12} className="text-muted/40 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
