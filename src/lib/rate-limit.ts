// src/lib/rate-limit.ts — API rate limiting (token-bucket, bellek içi)

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

export function checkRate(
  key: string,
  maxTokens: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    buckets.set(key, bucket);
    return { allowed: true, remaining: bucket.tokens, resetIn: 0 };
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  const refill = Math.floor(elapsed * (maxTokens / windowSeconds));

  if (refill > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    const resetIn = Math.ceil(
      (1 - bucket.tokens / maxTokens) * windowSeconds,
    );
    return { allowed: true, remaining: bucket.tokens, resetIn };
  }

  const resetIn = Math.ceil(windowSeconds - elapsed);
  return { allowed: false, remaining: 0, resetIn };
}

export function checkOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = [
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost:3000",
  ].filter(Boolean);
  if (allowed.length === 0) return true; // geliştirme modu
  return allowed.some((a) => origin.startsWith(a ?? ""));
}

// IP tabanlı rate limit
export function checkRateByIP(
  ip: string,
  maxTokens: number,
  windowSeconds: number,
) {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    ipBuckets.set(ip, bucket);
    return { allowed: true, remaining: bucket.tokens, resetIn: 0 };
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  const refill = Math.floor(elapsed * (maxTokens / windowSeconds));

  if (refill > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetIn: Math.ceil((1 - bucket.tokens / maxTokens) * windowSeconds),
    };
  }

  return { allowed: false, remaining: 0, resetIn: Math.ceil(windowSeconds - elapsed) };
}

// Periyodik temizlik
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, v] of buckets) {
      if (v.lastRefill < cutoff) buckets.delete(k);
    }
    for (const [k, v] of ipBuckets) {
      if (v.lastRefill < cutoff) ipBuckets.delete(k);
    }
  }, 60_000);
}
