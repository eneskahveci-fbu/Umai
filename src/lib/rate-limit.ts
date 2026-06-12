// ── İstemci-tanımlı rate limiter (IP bazlı) ──

const stores = new Map<string, Map<string, { count: number; reset: number }>>();

function getStore(key: string): Map<string, { count: number; reset: number }> {
  let s = stores.get(key);
  if (!s) {
    s = new Map();
    stores.set(key, s);
  }
  // Periyodik temizlik: 5 dakikada bir süresi dolmuş girişleri sil
  if (Math.random() < 0.01) {
    const now = Date.now();
    for (const [k, v] of s) {
      if (now > v.reset) s.delete(k);
    }
    if (s.size === 0) stores.delete(key);
  }
  return s;
}

export function checkLimit(
  req: Request,
  key: string,
  maxRequests: number,
  windowMs: number,
): { status: number; body: { error: string }; retryAfter: number } | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Yerel IP'leri sınırlama
  if (ip === "::1" || ip === "127.0.0.1" || ip === "unknown") return null;

  const store = getStore(key);
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.reset) {
    store.set(ip, { count: 1, reset: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    return {
      status: 429,
      body: {
        error: `Çok fazla istek. ${Math.ceil((entry.reset - now) / 1000)} saniye sonra tekrar dene.`,
      },
      retryAfter: Math.ceil((entry.reset - now) / 1000),
    };
  }

  entry.count++;
  return null;
}
