"use client";

import { X, ArrowLeftRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

function simpleDiff(oldText: string, newText: string): Array<{ type: "same" | "add" | "remove"; value: string }> {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: Array<{ type: "same" | "add" | "remove"; value: string }> = [];

  // En uzun ortak alt-dizi (LCS) tabanlı basit diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Geriye doğru izle
  let i = m, j = n;
  const temp: Array<{ type: "same" | "add" | "remove"; value: string }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: "same", value: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: "add", value: newLines[j - 1] });
      j--;
    } else {
      temp.push({ type: "remove", value: oldLines[i - 1] });
      i--;
    }
  }
  return temp.reverse();
}

export function DiffModal() {
  const open = useStore((s) => s.diffOpen);
  const diff = useStore((s) => s.diff);
  const setDiff = useStore((s) => s.setDiff);
  const setDiffOpen = useStore((s) => s.setDiffOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDiffOpen(false);
        setDiff(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setDiffOpen, setDiff]);

  if (!open || !diff) return null;

  const lines = simpleDiff(diff.left, diff.right);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setDiffOpen(false);
          setDiff(null);
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Değişiklik karşılaştırma"
    >
      <div
        ref={ref}
        className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={15} className="text-muted" />
            <h2 className="text-sm font-semibold">{diff.title ?? "Değişiklik Karşılaştırma"}</h2>
          </div>
          <button
            onClick={() => {
              setDiffOpen(false);
              setDiff(null);
            }}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors"
            aria-label="Kapat"
          >
            <X size={15} />
          </button>
        </div>

        {/* Diff content */}
        <div className="overflow-y-auto flex-1 font-mono text-xs leading-relaxed">
          <div className="flex">
            {/* Sol — eski */}
            <div className="flex-1 min-w-0 border-r border-line/50 bg-red-50/20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted/60 px-4 py-2 border-b border-line/30 sticky top-0 bg-surface">
                Önceki
              </div>
              {lines.filter((l) => l.type !== "add").map((line, i) => (
                <div
                  key={i}
                  className={`px-4 py-0.5 whitespace-pre-wrap break-all ${
                    line.type === "remove"
                      ? "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300"
                      : "text-muted"
                  }`}
                >
                  {line.type === "remove" && <span className="select-none mr-2 text-red-400">-</span>}
                  {line.type === "same" && <span className="select-none mr-2">&nbsp;</span>}
                  {line.value || "\u00A0"}
                </div>
              ))}
            </div>

            {/* Sağ — yeni */}
            <div className="flex-1 min-w-0 bg-green-50/20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted/60 px-4 py-2 border-b border-line/30 sticky top-0 bg-surface">
                Sonraki
              </div>
              {lines.filter((l) => l.type !== "remove").map((line, i) => (
                <div
                  key={i}
                  className={`px-4 py-0.5 whitespace-pre-wrap break-all ${
                    line.type === "add"
                      ? "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300"
                      : "text-muted"
                  }`}
                >
                  {line.type === "add" && <span className="select-none mr-2 text-green-400">+</span>}
                  {line.type === "same" && <span className="select-none mr-2">&nbsp;</span>}
                  {line.value || "\u00A0"}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
