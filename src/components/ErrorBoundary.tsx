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

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-screen bg-bg text-ink p-8">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold mb-2">Bir şeyler yanlış gitti</h2>
              <p className="text-muted text-sm mb-4">
                {this.state.error?.message ?? "Beklenmeyen bir hata oluştu."}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-amber-400 text-black rounded-xl font-medium transition-colors hover:bg-amber-300"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
