// ── Doğrulama yardımcıları ──

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

export function isValidationError(e: unknown): e is ValidationError {
  return e instanceof ValidationError;
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text.trim()) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError("Geçersiz JSON", 400);
  }
}

// ── Alan doğrulayıcılar ──

function trim(v: unknown): string {
  if (typeof v !== "string") throw new ValidationError("metin olmalı", 400);
  return v.trim();
}

export function asOwner(v: unknown): string {
  const s = trim(v);
  if (!s || s.length > 100) throw new ValidationError("owner: 1-100 karakter olmalı", 400);
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(s))
    throw new ValidationError("owner: geçersiz GitHub kullanıcı adı", 400);
  return s;
}

export function asRepo(v: unknown): string {
  const s = trim(v);
  if (!s || s.length > 100) throw new ValidationError("repo: 1-100 karakter olmalı", 400);
  if (!/^[a-zA-Z0-9._-]+$/.test(s))
    throw new ValidationError("repo: geçersiz repo adı", 400);
  return s;
}

export function asBranch(v: unknown): string {
  const s = trim(v);
  if (!s || s.length > 250) throw new ValidationError("branch: 1-250 karakter olmalı", 400);
  if (/[ ~^:*?[\\\]]/.test(s))
    throw new ValidationError("branch: geçersiz karakter içeriyor", 400);
  return s;
}

export function asRepoPath(v: unknown): string {
  const s = trim(v);
  if (!s || s.length > 500) throw new ValidationError("path: 1-500 karakter olmalı", 400);
  if (s.includes("..")) throw new ValidationError("path: .. içeremez", 400);
  if (!/^[a-zA-Z0-9/._-]+$/.test(s))
    throw new ValidationError("path: geçersiz karakter içeriyor", 400);
  return s;
}

export function asContent(v: unknown): string {
  const s = trim(v);
  if (!s) throw new ValidationError("content: boş olamaz", 400);
  if (s.length > 1_000_000) throw new ValidationError("content: çok büyük (>1MB)", 400);
  return s;
}

export function asToken(v: unknown): string {
  const s = trim(v);
  if (!s || s.length < 10) throw new ValidationError("token: gerekli", 401);
  if (s.length > 500) throw new ValidationError("token: çok uzun", 400);
  return s;
}

export function asOptString(
  v: unknown,
  field: string,
  opts?: { max?: number },
): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = trim(v);
  if (s.length === 0) return undefined;
  if (opts?.max && s.length > opts.max)
    throw new ValidationError(`${field}: en fazla ${opts.max} karakter`, 400);
  return s;
}

// ── Rate limit / Origin check (basit, API route'larda inline da var) ──

const rl = new Map<string, { count: number; reset: number }>();

export function checkRate(ip: string, max = 120, windowMs = 60_000): boolean {
  if (ip === "unknown" || ip === "::1" || ip === "127.0.0.1") return true;
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.reset) {
    rl.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
