"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-8 bg-bg text-ink">
          <div className="text-center max-w-md">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red" />
            <h2 className="text-xl font-bold mb-2">Bir hata oluştu</h2>
            <p className="text-muted text-sm mb-4">
              {this.state.error?.message || "Beklenmeyen bir hata."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white font-semibold text-sm"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
