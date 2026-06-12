"use client";

// src/components/DiffViewer.tsx — Model karşılaştırma sonuçları görüntüleyici

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export interface CompareResult {
  modelName: string;
  content: string;
  error?: string;
  tokensPerSecond?: number;
}

interface Props {
  prompt: string;
  results: CompareResult[];
}

export function DiffViewer({ prompt, results }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyResult = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      // sessiz
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* İstem özeti */}
      <div className="p-3 rounded-xl bg-bgsoft border border-line">
        <p className="text-[10px] text-muted uppercase tracking-wide mb-1">İstem</p>
        <p className="text-sm text-ink">{prompt}</p>
      </div>

      {/* Sonuç kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((r, i) => (
          <div
            key={i}
            className="rounded-xl border border-line bg-bgsoft overflow-hidden"
          >
            {/* Başlık */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-surface/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{r.modelName}</span>
                {r.tokensPerSecond !== undefined && (
                  <span className="text-[10px] text-muted">
                    ~{r.tokensPerSecond.toFixed(1)} tok/s
                  </span>
                )}
              </div>
              {!r.error && (
                <button
                  onClick={() => copyResult(i, r.content)}
                  className="p-1 hover:bg-bgsoft rounded transition-colors text-muted hover:text-ink"
                  title="Kopyala"
                  aria-label={`${r.modelName} yanıtını kopyala`}
                >
                  {copiedIdx === i ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              )}
            </div>

            {/* İçerik */}
            <div className="p-3 max-h-64 overflow-y-auto">
              {r.error ? (
                <p className="text-sm text-red-400">❌ {r.error}</p>
              ) : (
                <pre className="text-xs text-ink whitespace-pre-wrap font-mono leading-relaxed">
                  {r.content || "(boş yanıt)"}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
