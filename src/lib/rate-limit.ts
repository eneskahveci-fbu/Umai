/* In-memory IP-based rate limiter. Resets on process restart, which is fine
   as a first line of defence against a single-client burst. Use a real
   store (Upstash/Redis) for production multi-instance fairness. */

interface Bucket { tokens: number; resetAt: number }
const buckets = new Map<string, Bucket>();

/* Yalnızca header okuduğu için hem Request hem NextRequest kabul eder. */
function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  return `${scope}:${ip}`;
}

/* Cap: `max` requests per `windowMs` per IP per scope.
   Returns null when allowed; otherwise a NextResponse-ready { status, body }. */
export function checkLimit(
  req: Request,
  scope: string,
  max: number,
  windowMs: number,
): { status: number; body: { error: string }; retryAfter: number } | null {
  const key = clientKey(req, scope);
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { tokens: max - 1, resetAt: now + windowMs });
    return null;
  }
  if (cur.tokens > 0) {
    cur.tokens--;
    return null;
  }
  const retryAfter = Math.ceil((cur.resetAt - now) / 1000);
  return {
    status: 429,
    body: { error: `Çok fazla istek. ${retryAfter}s sonra tekrar dene.` },
    retryAfter,
  };
}

/* Kısayol: limit aşıldıysa hazır 429 Response döndürür, aksi halde null.
   `const r = rateLimit(req, "scope", 30, 60_000); if (r) return r;` */
export function rateLimit(
  req: Request,
  scope: string,
  max: number,
  windowMs: number,
): Response | null {
  const limited = checkLimit(req, scope, max, windowMs);
  if (!limited) return null;
  return Response.json(limited.body, {
    status: limited.status,
    headers: { "Retry-After": String(limited.retryAfter) },
  });
}

/* Trim old entries on a soft interval to bound memory. */
if (typeof globalThis !== "undefined") {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = globalThis as any;
  if (!g.__rateLimitSweeper) {
    g.__rateLimitSweeper = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }, 60_000).unref?.();
  }
}
