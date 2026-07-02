"use client";

import { useEffect, useRef } from "react";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";
import { useStore } from "@/lib/store";

const ICONS = {
  success: <CheckCircle size={16} className="text-green" />,
  error: <AlertTriangle size={16} className="text-red" />,
  info: <Info size={16} className="text-blue" />,
};

function ToastItem({ id, type, message, action, duration }: { id: string; type: "success" | "error" | "info"; message: string; action?: { label: string; fn: () => void }; duration?: number }) {
  const removeToast = useStore((s) => s.removeToast);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timer.current = setTimeout(() => removeToast(id), duration ?? (type === "error" ? 5000 : 3000));
    return () => clearTimeout(timer.current);
  }, [id, type, duration, removeToast]);

  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-line bg-surface/95 backdrop-blur-sm shadow-xl toast-enter">
      <span className="shrink-0 mt-0.5">{ICONS[type]}</span>
      <p className="flex-1 text-sm leading-relaxed">{message}</p>
      {action && (
        <button
          onClick={() => { action.fn(); removeToast(id); }}
          className="shrink-0 text-xs font-bold text-brand hover:text-branddim px-2 py-0.5 rounded-lg bg-brand/10 hover:bg-brand/20 transition-colors"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => removeToast(id)}
        className="shrink-0 text-muted hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm"
      style={{
        right: "max(1.25rem, env(safe-area-inset-right))",
        bottom: "max(1.25rem, env(safe-area-inset-bottom))",
        left: "auto",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} type={t.type} message={t.message} action={t.action} duration={t.duration} />
      ))}
    </div>
  );
}
