"use client";

// src/components/Provider.tsx — Uygulama geneli sağlayıcı sarmalayıcı
import { type ReactNode } from "react";
import { ToastProvider } from "./Toast";
import { ErrorBoundary } from "./ErrorBoundary";
import { OfflineBanner } from "./OfflineBanner";

interface Props {
  children: ReactNode;
}

export function Provider({ children }: Props) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <OfflineBanner />
        {children}
      </ToastProvider>
    </ErrorBoundary>
  );
}

// Ayrıca client boundary'leri için tekrar ihraç
export { ToastProvider, useToast } from "./Toast";
export { ErrorBoundary } from "./ErrorBoundary";
export { OfflineBanner } from "./OfflineBanner";
export { KeyboardShortcuts, getDefaultShortcuts } from "./KeyboardShortcuts";
