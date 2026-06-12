"use client";

import { useEffect } from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useStore } from "@/lib/store";

const iconMap = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: "border-green-500/30 bg-green-500/10 text-green-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = iconMap[t.type ?? "info"];
        const color = colorMap[t.type ?? "info"];

        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border p-3 shadow-lg flex items-start gap-3 animate-slide-up ${color}`}
          >
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 hover:opacity-70 transition-opacity"
              title="Kapat"
              aria-label="Kapat"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
