"use client";

import { FolderGit2, GitBranch } from "lucide-react";
import { useStore } from "@/lib/store";

/* Boş oturum ekranı — Claude Code tarzı sade (Eyl 2026 kullanıcı kararı:
   "ana ekranda gereksiz yönlendirme olmasın"). Başka sayfalara giden kart/
   bağlantı YOK: depo seçimi/bağlama Sidebar → Repolar'da, eski oturumlar
   Sidebar → Son oturumlar'da. Bağlı depo varsa yalnız adı ve dalı gösterilir;
   projesiz sohbet için composer'a yazmak yeterli. */
export function EmptyChat() {
  const repo = useStore((s) => s.repo);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 select-none">
      {repo && (
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
      )}
      <h2 className="text-[26px] sm:text-[28px] font-extrabold tracking-tight text-center text-balance">
        {repo ? "Bu projede ne yapalım?" : "Ne üzerinde çalışalım?"}
      </h2>
    </div>
  );
}
