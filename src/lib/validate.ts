// ── Giriş Doğrulama ──

const SAFE_ORIGINS = [
  "localhost",
  "127.0.0.1",
  "craft-ai-web.vercel.app",
];

/**
 * Origin kontrolü: yalnızca aynı host'tan veya izin verilenlerden gelen isteklere izin ver.
 */
export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin veya araç isteği
  const host = req.headers.get("host");
  if (!host) return true;
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
    if (SAFE_ORIGINS.includes(originHost)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * IP adresinden X-Forwarded-For veya doğrudan bağlantı IP'sini çıkar.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * API anahtarı formatı geçerli mi?
 */
export function isValidApiKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 8;
}

/**
 * E-posta formatı geçerli mi?
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * URL formatı geçerli mi?
 */
export function isValidUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * JSON parse güvenli
 */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Metinden HTML özel karakterlerini kaçır (XSS önleme).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Dosya yolunun güvenli olup olmadığını kontrol et (../../ ataklarına karşı).
 */
export function isSafePath(path: string): boolean {
  if (!path || path.includes("\0")) return false;
  if (path.includes("..")) return false;
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return false;
  return true;
}
