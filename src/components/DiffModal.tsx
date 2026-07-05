"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import { diffLines } from "diff";
import { useStore } from "@/lib/store";
import { highlightLines, type Token } from "@/lib/highlight";
import { quickComplete } from "@/lib/quickComplete";
import { buildUnifiedDiff, DIFF_SUMMARY_SYSTEM } from "@/lib/commitMsg";

interface DiffLine {
  type: "ctx" | "add" | "del";
  text: string;
  oldNo?: number;
  newNo?: number;
}

/* Satır bazlı diff — jsdiff (Myers algoritması). Naif LCS'e göre büyük
   dosyalarda daha verimli ve hunk'ları daha isabetli. */
function computeDiff(a: string, b: string): DiffLine[] {
  const parts = diffLines(a, b);
  const result: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (const part of parts) {
    /* Son parçanın sondaki boş satırı çift sayılmasın. */
    const lines = part.value.split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) {
      if (part.added) {
        result.push({ type: "add", text, newNo: newNo++ });
      } else if (part.removed) {
        result.push({ type: "del", text, oldNo: oldNo++ });
      } else {
        result.push({ type: "ctx", text, oldNo: oldNo++, newNo: newNo++ });
      }
    }
  }
  return result;
}

export function DiffModal() {
  const diff = useStore((s) => s.diffModal);
  const setDiff = useStore((s) => s.setDiffModal);
  const addToast = useStore((s) => s.addToast);
  const [copied, setCopied] = useState(false);
  /* AI özet: diff'in ne yaptığını maddelerle anlatır (Copilot PR-özeti benzeri). */
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  /* Yeni diff gelince eski özeti temizle (render sırasında önceki-değer deseni). */
  const diffKey = diff ? `${diff.path}|${diff.newCode.length}|${diff.original.length}` : "";
  const [prevDiffKey, setPrevDiffKey] = useState(diffKey);
  if (diffKey !== prevDiffKey) { setPrevDiffKey(diffKey); setSummary(null); }

  const summarize = async () => {
    if (!diff || summarizing) return;
    setSummarizing(true);
    try {
      const ud = buildUnifiedDiff(diff.path || "dosya", diff.original, diff.newCode, 16000);
      const out = await quickComplete(`Diff:\n\n${ud}`, DIFF_SUMMARY_SYSTEM);
      if (!out.trim()) throw new Error("boş yanıt");
      setSummary(out.trim());
    } catch (e) {
      addToast(`Özet üretilemedi: ${(e as Error).message}`, "error");
    } finally {
      setSummarizing(false);
    }
  };

  const lines = useMemo(
    () => (diff ? computeDiff(diff.original, diff.newCode) : []),
    [diff],
  );

  /* Shiki ile satır-token'larını (renkli) async hesapla. Yüklenene kadar düz
     metin gösterilir; gelince renklenir. */
  const [oldTok, setOldTok] = useState<Token[][]>([]);
  const [newTok, setNewTok] = useState<Token[][]>([]);
  useEffect(() => {
    if (!diff) return;
    let cancelled = false;
    const lang = diff.language || "text";
    Promise.all([
      highlightLines(diff.original, lang),
      highlightLines(diff.newCode, lang),
    ]).then(([o, n]) => {
      if (!cancelled) { setOldTok(o); setNewTok(n); }
    });
    return () => { cancelled = true; };
  }, [diff]);

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
              onClick={() => void summarize()}
              disabled={summarizing}
              title="Değişikliği AI ile özetle"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 font-semibold disabled:opacity-50 transition-colors"
            >
              {summarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              AI özet
            </button>
            <button
              onClick={copyNew}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand hover:bg-branddim text-[#111110] font-semibold transition-colors"
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

        {/* AI özet paneli */}
        {summary && (
          <div className="px-5 py-3 border-b border-line/60 bg-brand/5 shrink-0 max-h-40 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand/70 mb-1 flex items-center gap-1"><Sparkles size={10} /> AI özet</div>
            <div className="text-xs leading-relaxed whitespace-pre-wrap text-ink/85">{summary}</div>
          </div>
        )}

        {/* Diff body */}
        <div className="flex-1 overflow-auto bg-codebg font-mono text-[12px] leading-relaxed">
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
              <span className="whitespace-pre flex-1 break-all">
                {(() => {
                  const toks =
                    l.type === "del"
                      ? oldTok[(l.oldNo ?? 1) - 1]
                      : newTok[(l.newNo ?? 1) - 1];
                  if (!toks || !toks.length) return l.text || " ";
                  return toks.map((t, ti) => (
                    <span key={ti} style={t.color ? { color: t.color } : undefined}>
                      {t.content}
                    </span>
                  ));
                })()}
              </span>
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
