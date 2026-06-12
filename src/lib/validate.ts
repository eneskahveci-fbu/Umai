// ── Giriş doğrulama yardımcıları ──

export function isValidRepoOwner(v: unknown): v is string {
  return typeof v === "string" && /^[a-zA-Z0-9._-]+$/.test(v) && v.length > 0 && v.length <= 100;
}

export function isValidRepoName(v: unknown): v is string {
  return typeof v === "string" && /^[a-zA-Z0-9._-]+$/.test(v) && v.length > 0 && v.length <= 100;
}

export function isValidBranch(v: unknown): v is string {
  return typeof v === "string" && /^[a-zA-Z0-9._/()-]+$/.test(v) && v.length > 0 && v.length <= 250;
}

export function isValidFilePath(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0 || v.length > 4000) return false;
  if (v.includes("..")) return false;
  if (/[<>"|?*]/.test(v)) return false;
  return true;
}

export function isValidToken(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 500;
}

export function sanitizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function validateRepoCtx(ctx: { owner?: unknown; repo?: unknown; branch?: unknown }): {
  valid: boolean;
  error?: string;
} {
  if (!isValidRepoOwner(ctx.owner)) return { valid: false, error: "Geçersiz repo sahibi" };
  if (!isValidRepoName(ctx.repo)) return { valid: false, error: "Geçersiz repo adı" };
  if (ctx.branch !== undefined && !isValidBranch(ctx.branch))
    return { valid: false, error: "Geçersiz branch adı" };
  return { valid: true };
}
