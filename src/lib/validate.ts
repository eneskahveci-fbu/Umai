/**
 * Bağımlılıksız, hafif input doğrulama yardımcıları.
 * API rotalarında path traversal, boyut taşması ve format ihlallerini engeller.
 */

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "ValidationError";
  }
}

/* GitHub owner/repo: GitHub'ın izin verdiği karakter sınıfları.
 * owner: [A-Za-z0-9-] (max 39 karakter)
 * repo:  [A-Za-z0-9._-] (max 100 karakter) */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
/* Branch adı: refname kuralları (basitleştirilmiş, güvenli set) */
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,255}$/;
/* GitHub token: gho_, ghp_, ghu_, ghs_, ghr_ prefixleri veya klasik 40 hex */
const TOKEN_RE = /^(?:gh[opusr]_[A-Za-z0-9]{20,255}|[A-Fa-f0-9]{40})$/;

export function asString(v: unknown, field: string, opts: { max?: number; min?: number } = {}): string {
  if (typeof v !== "string") throw new ValidationError(`${field}: metin olmalı`);
  const s = v.trim();
  const max = opts.max ?? 10_000;
  const min = opts.min ?? 1;
  if (s.length < min) throw new ValidationError(`${field}: boş olamaz`);
  if (s.length > max) throw new ValidationError(`${field}: çok uzun (>${max})`);
  return s;
}

export function asOptString(v: unknown, field: string, opts: { max?: number } = {}): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return asString(v, field, opts);
}

export function asOwner(v: unknown): string {
  const s = asString(v, "owner", { max: 39 });
  if (!OWNER_RE.test(s)) throw new ValidationError("owner: geçersiz GitHub kullanıcı adı");
  return s;
}

export function asRepo(v: unknown): string {
  const s = asString(v, "repo", { max: 100 });
  if (!REPO_RE.test(s)) throw new ValidationError("repo: geçersiz depo adı");
  if (s === "." || s === "..") throw new ValidationError("repo: geçersiz depo adı");
  return s;
}

export function asBranch(v: unknown): string {
  const s = asString(v, "branch", { max: 255 });
  if (!BRANCH_RE.test(s)) throw new ValidationError("branch: geçersiz dal adı");
  if (s.startsWith("/") || s.endsWith("/") || s.includes("..") || s.includes("//")) {
    throw new ValidationError("branch: geçersiz dal adı");
  }
  return s;
}

export function asToken(v: unknown): string {
  const s = asString(v, "token", { max: 255 });
  if (!TOKEN_RE.test(s)) throw new ValidationError("token: geçersiz format");
  return s;
}

/* Repo-içi yol: path traversal koruması.
 * - Mutlak yol olamaz (/ ile başlayamaz)
 * - .. segmenti olamaz
 * - NUL / kontrol karakteri olamaz
 * - Sondaki / atılır
 * - Segment başına 255, toplam 1024 karakter sınırı */
export function asRepoPath(v: unknown): string {
  const raw = asString(v, "path", { max: 1024 });
  if (raw.startsWith("/")) throw new ValidationError("path: mutlak yol kabul edilmez");
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) < 0x20) {
      throw new ValidationError("path: kontrol karakteri içeremez");
    }
  }
  const segments = raw.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new ValidationError("path: '.' veya '..' segmenti kabul edilmez");
    }
    if (seg.length > 255) throw new ValidationError("path: segment çok uzun");
  }
  return segments.join("/");
}

export function asContent(v: unknown, maxBytes = 1_000_000): string {
  if (typeof v !== "string") throw new ValidationError("content: metin olmalı");
  const byteLen = Buffer.byteLength(v, "utf-8");
  if (byteLen > maxBytes) {
    throw new ValidationError(
      `content: dosya çok büyük (${byteLen} bayt, üst sınır ${maxBytes})`,
      413,
    );
  }
  return v;
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    throw new ValidationError("Content-Type application/json olmalı", 415);
  }
  try {
    return (await req.json()) as T;
  } catch {
    throw new ValidationError("Geçersiz JSON gövdesi", 400);
  }
}

export function isValidationError(e: unknown): e is ValidationError {
  return e instanceof ValidationError;
}
