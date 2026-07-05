"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  /* "inline" renders a compact error card instead of a full-screen one. */
  variant?: "fullscreen" | "inline";
  label?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (typeof console !== "undefined") console.error("ErrorBoundary caught:", error);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || "Beklenmeyen bir hata.";

    if (this.props.variant === "inline") {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-bgsoft/40 border border-red/30 rounded-xl text-center">
          <AlertTriangle size={20} className="text-red mb-2" />
          <p className="text-sm font-semibold text-ink mb-1">{this.props.label ?? "Bileşen çöktü"}</p>
          <p className="text-[11px] text-muted/70 mb-3 max-w-md break-words">{msg}</p>
          <button
            onClick={this.reset}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-brand/15 text-brand hover:bg-brand/25 transition-colors font-semibold"
          >
            Yeniden dene
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen grid place-items-center p-8 bg-bg text-ink">
        <div className="text-center max-w-md">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red" />
          <h2 className="text-xl font-bold mb-2">Bir hata oluştu</h2>
          <p className="text-muted text-sm mb-4">{msg}</p>
          <button
            onClick={() => { this.reset(); window.location.reload(); }}
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold text-sm"
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    );
  }
}
