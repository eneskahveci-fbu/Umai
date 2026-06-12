"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  title?: string;
  leftContent?: string;
  rightContent?: string;
  leftLabel?: string;
  rightLabel?: string;
  open?: boolean;
  onClose?: () => void;
}

export function DiffModal({ title, leftContent, rightContent, leftLabel, rightLabel, open, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [splitView, setSplitView] = useState(true);

  const isControlled = open !== undefined;
  const visible = isControlled ? open : isOpen;

  const close = useCallback(() => {
    if (isControlled) onClose?.();
    else setIsOpen(false);
  }, [isControlled, onClose]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-diff", handler);
    return () => window.removeEventListener("open-diff", handler);
  }, []);

  if (!visible) return null;

  const renderLines = (text?: string) => {
    if (!text) return <div className="text-[var(--color-ink)]/30 italic p-4">İçerik yok</div>;
    return text.split("\n").map((line, i) => (
      <div key={i} className="flex">
        <span className="w-10 text-right pr-3 text-[10px] text-[var(--color-ink)]/30 select-none leading-6 shrink-0">
          {i + 1}
        </span>
        <span className="font-mono text-xs leading-6 whitespace-pre-wrap break-all">{line}</span>
      </div>
    ));
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-5xl max-h-[85vh] bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-surface)]">
          <h2 className="text-base font-semibold flex items-center gap-2">
            🔄 {title || "Karşılaştırma"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSplitView(!splitView)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                splitView ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]" : "bg-[var(--color-surface)] text-[var(--color-ink)]/60"
              }`}
            >
              {splitView ? "Yan Yana" : "Birleşik"}
            </button>
            <button onClick={close} className="text-[var(--color-ink)]/40 hover:text-[var(--color-ink)] transition-colors text-lg">
              ✕
            </button>
          </div>
        </div>

        {/* Diff içerik */}
        <div className={`flex-1 overflow-auto ${splitView ? "grid grid-cols-2 divide-x divide-[var(--color-surface)]" : ""}`}>
          {splitView ? (
            <>
              <div>
                <div className="sticky top-0 px-4 py-2 bg-[var(--color-surface)]/50 text-xs font-medium text-[var(--color-ink)]/60 border-b border-[var(--color-surface)]">
                  {leftLabel || "Önceki"}
                </div>
                <div className="p-2">{renderLines(leftContent)}</div>
              </div>
              <div>
                <div className="sticky top-0 px-4 py-2 bg-[var(--color-surface)]/50 text-xs font-medium text-[var(--color-ink)]/60 border-b border-[var(--color-surface)]">
                  {rightLabel || "Sonraki"}
                </div>
                <div className="p-2">{renderLines(rightContent)}</div>
              </div>
            </>
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <div className="text-xs font-medium text-[var(--color-ink)]/60 mb-2 px-2">
                  {leftLabel || "Önceki"}
                </div>
                <div className="bg-[var(--color-surface)]/30 rounded-xl p-3">{renderLines(leftContent)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--color-ink)]/60 mb-2 px-2">
                  {rightLabel || "Sonraki"}
                </div>
                <div className="bg-[var(--color-surface)]/30 rounded-xl p-3">{renderLines(rightContent)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
