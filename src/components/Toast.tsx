"use client";

// src/components/Toast.tsx — Bildirim toast bileşeni + useToast hook

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  removeToast: () => {},
});

// ToastContainer alias — app/page.tsx uyumluluğu için
export const ToastContainer = ToastProvider;

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-green-600 text-white border-green-500",
  error: "bg-red-600 text-white border-red-500",
  warning: "bg-amber-600 text-white border-amber-500",
  info: "bg-blue-600 text-white border-blue-500",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-label="Bildirimler"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl border text-sm font-medium shadow-lg flex items-center gap-2 min-w-[280px] max-w-[420px] animate-slideUp ${variantStyles[t.variant]}`}
            role="status"
          >
            <span className="text-lg leading-none">{variantIcons[t.variant]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 text-white/70 hover:text-white transition-colors text-lg leading-none"
              aria-label="Kapat"
              title="Kapat"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
