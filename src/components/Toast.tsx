"use client";

import { X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";

const icons = {
  info: <Info size={14} />,
  success: <CheckCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  error: <XCircle size={14} />,
};

const colors = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-red-50 text-red-800 border-red-200",
};

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm animate-in slide-in-from-right-full ${
            colors[t.type ?? "info"]
          }`}
          role="alert"
        >
          <span className="shrink-0 mt-0.5">{icons[t.type ?? "info"]}</span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity -mr-1"
            aria-label="Kapat"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
