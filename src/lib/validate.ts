// src/lib/validate.ts — Kullanıcı girdisi doğrulama yardımcıları

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function isValidURL(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isValidToken(token: string): boolean {
  return /^[a-zA-Z0-9_\-.]{8,}$/.test(token);
}

export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export function validateEnv(): string[] {
  const warnings: string[] = [];
  if (!process.env.SUPABASE_URL) warnings.push("SUPABASE_URL eksik");
  if (!process.env.SUPABASE_ANON_KEY) warnings.push("SUPABASE_ANON_KEY eksik");
  return warnings;
}
