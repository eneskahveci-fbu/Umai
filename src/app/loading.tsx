export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Yükleniyor"
      className="min-h-screen grid place-items-center bg-bg"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl brand-gradient grid place-items-center text-white shadow-lg shadow-brand/25 animate-pulse"
          aria-hidden="true"
        >
          <span className="text-lg font-extrabold">◆</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" aria-hidden="true" />
          <span className="typing-dot delay-1" aria-hidden="true" />
          <span className="typing-dot delay-2" aria-hidden="true" />
        </div>
        <span className="sr-only">Yükleniyor…</span>
      </div>
    </div>
  );
}
