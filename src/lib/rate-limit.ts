/**
 * Basit, bağımlılıksız rate limiter (Map tabanlı).
 * IP başına dakikada belirli sayıda istek.
 */

interface Entry {
  count: number;
  reset: number;
}

export class RateLimiter {
  private store = new Map<string, Entry>();
  private maxPerMinute: number;
  private windowMs: number;

  constructor(maxPerMinute: number, windowMs = 60_000) {
    this.maxPerMinute = maxPerMinute;
    this.windowMs = windowMs;
  }

  /**
   * İstek yapılabilir mi?
   * - Bilinen yerel IP'ler her zaman izinli
   * - Süre aşmışsa sayaç sıfırlanır
   * - Limite ulaşıldıysa false döner
   */
  check(key: string): boolean {
    if (key === "unknown" || key === "::1" || key === "127.0.0.1") return true;
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now > entry.reset) {
      this.store.set(key, { count: 1, reset: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.maxPerMinute) return false;
    entry.count++;
    return true;
  }

  /** Kalan istek sayısı */
  remaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.maxPerMinute;
    return Math.max(0, this.maxPerMinute - entry.count);
  }
}

// Önceden yapılandırılmış örnekler
export const chatLimiter = new RateLimiter(120);
export const searchLimiter = new RateLimiter(5);
export const suggestLimiter = new RateLimiter(10);
export const shareLimiter = new RateLimiter(5);
