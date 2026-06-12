"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-screen bg-bg text-ink gap-4 p-8">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-bold">Bir şeyler ters gitti</h2>
            <p className="text-sm text-muted text-center max-w-md">
              {this.state.error?.message ?? "Beklenmeyen bir hata oluştu."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-amber-400 text-black font-medium text-sm hover:bg-amber-300 transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
