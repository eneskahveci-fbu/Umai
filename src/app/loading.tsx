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
          className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/25 grid place-items-center shadow-lg shadow-brand/10 animate-pulse"
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none"><path d="M14 4L23 9.5V18.5L14 24L5 18.5V9.5L14 4Z" stroke="#c8a87e" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><circle cx="14" cy="14" r="3" fill="#c8a87e" fillOpacity="0.8"/></svg>
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
