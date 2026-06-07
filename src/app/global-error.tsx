"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#111110",
          color: "#f0ebe0",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 460 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              margin: "0 auto 1.25rem",
              display: "grid",
              placeItems: "center",
              background: "rgba(255,107,107,0.12)",
              color: "#ff6b6b",
              fontSize: 32,
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Beklenmeyen bir hata oluştu
          </h1>
          <p style={{ color: "#9a9080", fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            Uygulama köke yakın bir noktada başarısız oldu. Lütfen tekrar dene; sorun
            sürerse sayfayı yenile.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.7rem",
                color: "#6e6e82",
                marginBottom: "1rem",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: 12,
                background: "#c8a87e",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.875rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Tekrar dene
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: 12,
                border: "1px solid #2e2a24",
                background: "transparent",
                color: "#f0ebe0",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Ana sayfaya dön
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
