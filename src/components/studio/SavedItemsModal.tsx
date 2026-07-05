"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Download, Trash2, X } from "lucide-react";

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-bg" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Icon size={14} className="text-brand" /> {title}</h2>
          <button onClick={onClose} className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={14} /></button>
        </div>
        {items.length === 0 && <p className="text-xs text-muted/60">{emptyLabel}</p>}
        {items.map((item) => (
          <div key={getKey(item)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line/60 hover:border-brand/40 transition-colors">
            <button onClick={() => onOpen(item)} className="flex-1 min-w-0 text-left">
              {renderRow(item)}
            </button>
            {onExportTemplate && (
              <button onClick={() => onExportTemplate(item)} className="w-7 h-7 grid place-items-center rounded-lg text-muted/50 hover:text-brand shrink-0" title="Şablon olarak dışa aktar (.json)">
                <Download size={13} />
              </button>
            )}
            <button onClick={() => onDelete(item)} className="w-7 h-7 grid place-items-center rounded-lg text-muted/50 hover:text-red shrink-0" title="Sil">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
