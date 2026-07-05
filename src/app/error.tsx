"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen grid place-items-center p-8 bg-bg text-ink"
    >
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red/10 grid place-items-center"
          aria-hidden="true"
        >
          <AlertTriangle size={32} className="text-red" />
        </div>
        <h1 className="text-xl font-bold mb-2">Sayfa yüklenirken hata oluştu</h1>
        <p className="text-muted text-sm mb-2 leading-relaxed">
          {error.message || "Beklenmeyen bir hata."}
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-muted/60 mb-5">ref: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold text-sm transition-colors"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Tekrar dene
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line hover:border-brand/50 text-ink font-semibold text-sm transition-colors"
          >
            <Home size={15} aria-hidden="true" />
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
