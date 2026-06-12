"use client";

// src/components/DiffModal.tsx — Çoklu model karşılaştırma modalı

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { X, Plus, Play, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import type { CompareResult } from "./DiffViewer";
import { DiffViewer } from "./DiffViewer";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DiffModal({ open, onClose }: Props) {
  const messages = useStore((s) => s.messages);
  const models = useStore((s) => s.models);

  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [loading, setLoading] = useState(false);

  const enabledModels = models.filter((m) => m.enabled);

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const runCompare = useCallback(async () => {
    if (!prompt.trim() || selectedModels.length === 0) return;
    setLoading(true);
    setResults([]);

    const newResults: CompareResult[] = [];
    for (const modelId of selectedModels) {
      const model = models.find((m) => m.id === modelId);
      if (!model) continue;

      try {
        const startTime = performance.now();
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId,
            messages: [{ role: "user", content: prompt }],
            stream: false,
            toolsEnabled: false,
          }),
        });

        const elapsed = (performance.now() - startTime) / 1000;
        if (!response.ok) {
          newResults.push({
            modelName: model.name,
            content: "",
            error: `HTTP ${response.status}`,
          });
          setResults([...newResults]);
          continue;
        }

        const data = (await response.json()) as { content: string };
        const tokensPerSecond = data.content.length / Math.max(elapsed, 0.1) / 4;
        newResults.push({
          modelName: model.name,
          content: data.content,
          tokensPerSecond,
        });
      } catch (err) {
        newResults.push({
          modelName: model.name,
          content: "",
          error: (err as Error).message,
        });
      }
      setResults([...newResults]);
    }
    setLoading(false);
  }, [prompt, selectedModels, models]);

  // Son kullanıcı mesajından prompt'u otomatik doldur
  const useLastMessage = () => {
    const last = messages.filter((m) => m.role === "user").pop();
    if (last) setPrompt(last.content);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Model karşılaştırma"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink">Model Karşılaştırma</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bgsoft rounded-lg transition-colors text-muted hover:text-ink"
            title="Kapat"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sonuç yoksa → kurulum */}
        {results.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Prompt */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                İstem
              </label>
              <div className="flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Karşılaştırılacak istem..."
                  rows={3}
                  className="flex-1 px-3 py-2 bg-bgsoft border border-line rounded-xl text-sm text-ink placeholder:text-muted outline-none focus:border-amber-400/50 transition-colors resize-none"
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={useLastMessage}
                    className="px-2 py-1.5 text-[10px] bg-bgsoft border border-line rounded-lg hover:bg-surface transition-colors text-muted"
                    title="Son mesajı kullan"
                  >
                    Son
                  </button>
                </div>
              </div>
            </div>

            {/* Model seçimi */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Modeller ({selectedModels.length} seçili)
              </label>
              <div className="flex flex-wrap gap-2">
                {enabledModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleModel(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedModels.includes(m.id)
                        ? "bg-amber-400 text-black"
                        : "bg-bgsoft border border-line text-muted hover:text-ink"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
                {enabledModels.length === 0 && (
                  <p className="text-xs text-muted py-2">
                    Karşılaştırma için önce ayarlardan model ekleyin.
                  </p>
                )}
              </div>
            </div>

            {/* Çalıştır */}
            <button
              onClick={runCompare}
              disabled={loading || !prompt.trim() || selectedModels.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Karşılaştırılıyor...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Karşılaştır
                </>
              )}
            </button>
          </div>
        ) : (
          /* Sonuçlar → DiffViewer */
          <DiffViewer prompt={prompt} results={results} />
        )}
      </div>
    </div>
  );
}
