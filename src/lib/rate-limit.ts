// ── In-memory rate limiter ──

export function createRateLimiter(windowMs = 60_000, maxRequests = 120) {
  const store = new Map<string, { count: number; reset: number }>();

  return {
    check(key: string): boolean {
      // Yerel IP'leri sınırlama
      if (key === "unknown" || key === "::1" || key === "127.0.0.1") return true;

      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.reset) {
        store.set(key, { count: 1, reset: now + windowMs });
        return true;
      }

      if (entry.count >= maxRequests) return false;
      entry.count++;
      return true;
    },

    reset(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },
  };
}
