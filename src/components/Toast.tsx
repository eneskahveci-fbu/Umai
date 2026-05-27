"use client";

import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";
import { useStore } from "@/lib/store";

const ICONS = {
  success: <CheckCircle size={16} className="text-green" />,
  error: <AlertTriangle size={16} className="text-red" />,
  info: <Info size={16} className="text-blue" />,
};

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-line bg-surface shadow-lg toast-enter"
        >
          <span className="shrink-0 mt-0.5">{ICONS[t.type]}</span>
          <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 text-muted hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
