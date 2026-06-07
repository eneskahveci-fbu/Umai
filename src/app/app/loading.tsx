export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Uygulama yükleniyor"
      className="flex h-screen overflow-hidden bg-bg"
    >
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-14 shrink-0 border-r border-line/60 flex-col items-center py-3 gap-2">
        <div className="w-8 h-8 rounded-xl bg-bgsoft animate-pulse" aria-hidden="true" />
        <div className="w-8 h-8 rounded-xl bg-bgsoft animate-pulse" aria-hidden="true" />
        <div className="w-8 h-8 rounded-xl bg-bgsoft animate-pulse" aria-hidden="true" />
      </div>

      {/* Main panel skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-line/60 flex items-center px-4 gap-3">
          <div className="w-32 h-7 rounded-lg bg-bgsoft animate-pulse" aria-hidden="true" />
          <div className="w-24 h-7 rounded-lg bg-bgsoft animate-pulse" aria-hidden="true" />
        </div>
        <div className="flex-1 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/25 grid place-items-center animate-pulse"
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none"><path d="M14 4L23 9.5V18.5L14 24L5 18.5V9.5L14 4Z" stroke="#c8a87e" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><circle cx="14" cy="14" r="3" fill="#c8a87e" fillOpacity="0.8"/></svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="typing-dot" aria-hidden="true" />
              <span className="typing-dot delay-1" aria-hidden="true" />
              <span className="typing-dot delay-2" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Uygulama yükleniyor…</span>
    </div>
  );
}
