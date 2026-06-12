"use client";

import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type?: Toast["type"], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;
let pushToast: ((t: Toast) => void) | null = null;

export function toast(message: string, type: Toast["type"] = "info", duration = 4000) {
  pushToast?.({ id: `toast-${++toastId}`, message, type, duration });
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    pushToast = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info", duration = 4000) => {
      const id = `toast-${++toastId}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    if (t.duration && t.duration > 0) {
      const timer = setTimeout(() => onRemove(t.id), t.duration);
      return () => clearTimeout(timer);
    }
  }, [t.id, t.duration, onRemove]);

  const colors: Record<Toast["type"], string> = {
    success: "border-green-500/40 bg-green-500/10 text-green-400",
    error: "border-red-500/40 bg-red-500/10 text-red-400",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    info: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  };

  return (
    <div
      className={`pointer-events-auto px-4 py-3 rounded-xl border backdrop-blur-lg text-sm shadow-lg
        animate-slide-in-right transition-all duration-300 max-w-sm ${colors[t.type]}`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span className="flex-1">{t.message}</span>
        <button
          onClick={() => onRemove(t.id)}
          className="opacity-60 hover:opacity-100 transition-opacity ml-2"
          aria-label="Kapat"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  // Bu bileşen ToastProvider'ı sarmalar — app/page.tsx bunu import ediyor
  // Gerçek implementasyon app layout'unda ToastProvider olarak kullanılır
  return null;
}
