"use client";

// src/components/DiffViewer.tsx — Çoklu model yanıt karşılaştırma görünümü

import { MarkdownRenderer } from "./MarkdownRenderer";

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
  const columns = results.length;

  return (
    <div className="flex flex-col h-full">
      {/* İstem bölümü */}
      <div className="p-4 bg-bgsoft border-b border-line">
        <h3 className="text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
          İstem
        </h3>
        <p className="text-sm text-ink">{prompt}</p>
      </div>

      {/* Karşılaştırma sütunları */}
      <div
        className="flex-1 grid gap-0 overflow-auto"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {results.map((r) => (
          <div
            key={r.modelName}
            className="border-r border-line last:border-r-0 overflow-auto"
          >
            {/* Model başlığı */}
            <div className="sticky top-0 z-10 px-3 py-2 bg-surface border-b border-line flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">
                {r.modelName}
              </span>
              {r.tokensPerSecond !== undefined && (
                <span className="text-xs text-muted">
                  {r.tokensPerSecond.toFixed(1)} tok/s
                </span>
              )}
            </div>

            {/* Yanıt içeriği */}
            <div className="p-3">
              {r.error ? (
                <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  ❌ {r.error}
                </div>
              ) : (
                <MarkdownRenderer content={r.content} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
