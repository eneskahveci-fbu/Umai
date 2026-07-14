"use client";

import { useId, useRef } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Download, Trash2, X } from "lucide-react";
import { useModalA11y } from "@/lib/useModalA11y";
import { useExitAnimation } from "@/lib/useExitAnimation";

/* Kayıtlı-öğe modalı — Doküman/Sunum/Anket/Defter'in 4 kez elle kopyaladığı
   "Kayıtlı X" listesini tek bileşene indirir. Satır içeriği (başlık/alt
   bilgi) çağırana bırakılır (renderRow); şablon dışa aktarma opsiyoneldir. */
export function SavedItemsModal<T>({
  open,
  onClose,
  title,
  icon: Icon,
  items,
  getKey,
  renderRow,
  onOpen,
  onDelete,
  onExportTemplate,
  emptyLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: LucideIcon;
  items: T[];
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  onOpen: (item: T) => void;
  onDelete: (item: T) => void;
  onExportTemplate?: (item: T) => void;
  emptyLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalA11y(ref, open, onClose);
  const { mounted, closing } = useExitAnimation(open);
  if (!mounted) return null;
  return (
    <div className={`fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 ${closing ? "animate-modal-bg-out" : "animate-modal-bg"}`} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id={titleId} className="text-sm font-bold flex items-center gap-1.5"><Icon size={14} className="text-brand" /> {title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={14} /></button>
        </div>
        {items.length === 0 && <p className="text-xs text-muted/60">{emptyLabel}</p>}
        {items.map((item) => (
          <div key={getKey(item)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line/60 hover:border-brand/40 transition-colors">
            <button onClick={() => onOpen(item)} className="flex-1 min-w-0 text-left">
              {renderRow(item)}
            </button>
            {onExportTemplate && (
              <button onClick={() => onExportTemplate(item)} aria-label="Şablon olarak dışa aktar (.json)" className="w-7 h-7 grid place-items-center rounded-lg text-muted/50 hover:text-brand shrink-0" title="Şablon olarak dışa aktar (.json)">
                <Download size={13} />
              </button>
            )}
            <button onClick={() => onDelete(item)} aria-label="Sil" className="w-7 h-7 grid place-items-center rounded-lg text-muted/50 hover:text-red shrink-0" title="Sil">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
