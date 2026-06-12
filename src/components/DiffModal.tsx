"use client";

import { useStore } from "@/lib/store";
import { X, ArrowLeftRight } from "lucide-react";

export function DiffModal() {
  const open = useStore((s) => s.diffModalOpen);
  const setOpen = useStore((s) => s.setDiffModalOpen);
  const diff = useStore((s) => s.diffContent);
  const setDiff = useStore((s) => s.setDiffContent);

  if (!open || !diff) return null;

  const handleClose = () => {
    setDiff(null);
    setOpen(false);
  };

  const lines = (text: string) => text.split("\n");

  const originalLines = lines(diff.original);
  const modifiedLines = lines(diff.modified);
  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-bg/80 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Diff karşılaştırma"
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-amber-400" />
            <h3 className="font-semibold">Değişiklikler</h3>
            <span className="text-xs text-muted font-mono ml-2">{diff.path}</span>
          </div>
          <button
            onClick={handleClose}
            className="hover:bg-bgsoft rounded-lg p-1 transition-colors"
            title="Kapat"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Diff view */}
        <div className="overflow-auto flex-1 font-mono text-xs leading-relaxed">
          <table className="w-full border-collapse">
            <tbody>
              {Array.from({ length: maxLines }).map((_, i) => {
                const orig = originalLines[i];
                const mod = modifiedLines[i];
                const isSame = orig === mod;
                const isAdded = orig === undefined && mod !== undefined;
                const isRemoved = mod === undefined && orig !== undefined;

                return (
                  <tr
                    key={i}
                    className={
                      isRemoved
                        ? "bg-red-500/10"
                        : isAdded
                          ? "bg-green-500/10"
                          : isSame
                            ? ""
                            : "bg-amber-500/5"
                    }
                  >
                    <td className="text-right text-muted px-2 py-0 select-none w-10 border-r border-line">
                      {isRemoved ? i + 1 : ""}
                    </td>
                    <td
                      className={`px-3 py-0 whitespace-pre ${
                        isRemoved ? "text-red-400" : "text-muted"
                      }`}
                    >
                      {isRemoved ? `- ${orig}` : ""}
                    </td>
                    <td className="text-right text-muted px-2 py-0 select-none w-10 border-r border-line">
                      {!isRemoved ? (originalLines.length > i ? i + 1 : i + 1) : ""}
                    </td>
                    <td
                      className={`px-3 py-0 whitespace-pre ${
                        isAdded
                          ? "text-green-400"
                          : isSame
                            ? "text-ink"
                            : "text-ink"
                      }`}
                    >
                      {isAdded ? `+ ${mod}` : isRemoved ? "" : mod}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
