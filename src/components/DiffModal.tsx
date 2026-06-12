"use client";

import { useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { useStore } from "@/lib/store";

interface DiffLine {
  type: "ctx" | "add" | "del";
  text: string;
  oldNo?: number;
  newNo?: number;
}

/* Basic line-based diff using LCS */
function computeDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const m = aLines.length;
  const n = bLines.length;

  /* LCS table */
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) lcs[i][j] = lcs[i - 1][j - 1] + 1;
      else lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m, j = n;
  let oldNo = m, newNo = n;
  const stack: DiffLine[] = [];
  while (i > 0 && j > 0) {
    if (aLines[i - 1] === bLines[j - 1]) {
      stack.push({ type: "ctx", text: aLines[i - 1], oldNo, newNo });
      i--; j--; oldNo--; newNo--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      stack.push({ type: "del", text: aLines[i - 1], oldNo });
      i--; oldNo--;
    } else {
      stack.push({ type: "add", text: bLines[j - 1], newNo });
      j--; newNo--;
    }
  }
  while (i > 0) { stack.push({ type: "del", text: aLines[i - 1], oldNo: oldNo-- }); i--; }
  while (j > 0) { stack.push({ type: "add", text: bLines[j - 1], newNo: newNo-- }); j--; }
  while (stack.length) result.push(stack.pop()!);
  return result;
}

export function DiffModal() {
  const diff = useStore((s) => s.diffModal);
  const setDiff = useStore((s) => s.setDiffModal);
  const addToast = useStore((s) => s.addToast);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(
    () => (diff ? computeDiff(diff.original, diff.newCode) : []),
    [diff],
  );

  if (!diff) return null;

  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;

  const copyNew = async () => {
    try {
      await navigator.clipboard.writeText(diff.newCode);
      setCopied(true);
      addToast("Yeni kod panoya kopyalandı", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Kopyalanamadı", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm grid place-items-center px-4 animate-modal-bg"
      onClick={() => setDiff(null)}
    >
      <div
        className="w-full max-w-4xl h-[80vh] bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-bold text-sm">Diff Görünümü</h2>
            {diff.path && (
              <code className="text-xs font-mono px-2 py-0.5 rounded-md bg-bgsoft border border-line/60 text-muted truncate">
                {diff.path}
              </code>
            )}
            <div className="flex items-center gap-2 text-[11px] shrink-0">
              <span className="text-green/80 font-mono">+{added}</span>
              <span className="text-red/80 font-mono">-{removed}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyNew}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand hover:bg-branddim text-white font-semibold transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Kopyalandı" : "Yeniyi kopyala"}
            </button>
            <button
              onClick={() => setDiff(null)}
              className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Diff body */}
        <div className="flex-1 overflow-auto bg-[#0a0a0d] font-mono text-[12px] leading-relaxed">
          {lines.map((l, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-3 py-0.5 ${
                l.type === "add"
                  ? "bg-green/8 text-green/90"
                  : l.type === "del"
                  ? "bg-red/8 text-red/90"
                  : "text-muted/70"
              }`}
            >
              <span className="w-10 text-right text-muted/30 shrink-0 select-none tabular-nums">
                {l.oldNo ?? ""}
              </span>
              <span className="w-10 text-right text-muted/30 shrink-0 select-none tabular-nums">
                {l.newNo ?? ""}
              </span>
              <span className="w-4 shrink-0 select-none font-bold">
                {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
              </span>
              <span className="whitespace-pre flex-1 break-all">{l.text || " "}</span>
            </div>
          ))}
        </div>

        <div className="px-5 py-2.5 border-t border-line/60 text-[11px] text-muted/50 text-center shrink-0">
          Yeni kodu kopyalayıp orijinal dosyana yapıştırarak uygula
        </div>
      </div>
    </div>
  );
}
