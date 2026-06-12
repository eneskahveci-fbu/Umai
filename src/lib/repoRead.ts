/**
 * GitHub/GitLab reposundan dosya okuma ve listeleme.
 * API route'lar ve araçlar tarafından kullanılır.
 */

import type { RepoReadCtx } from "./types";

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function glHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["PRIVATE-TOKEN"] = token;
  return h;
}

function encodeGlProject(owner: string, repo: string) {
  return encodeURIComponent(`${owner}/${repo}`);
}

/**
 * Repodaki tüm dosya yollarını döndürür (recursive).
 */
export async function listRepoFiles(ctx: RepoReadCtx): Promise<string[]> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
    const data = (await res.json()) as { path: string; type: string }[];
    return data.filter((t) => t.type === "blob").map((t) => t.path);
  }

  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  const data = (await res.json()) as {
    tree: { path: string; type: string }[];
  };
  return (data.tree || []).filter((t) => t.type === "blob").map((t) => t.path);
}

/**
 * Tek bir dosyanın içeriğini satır numaralarıyla okur.
 */
export async function readRepoFile(
  ctx: RepoReadCtx,
  path: string,
): Promise<{ content: string; lineCount: number }> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
    const content = await res.text();
    const lines = content.split("\n");
    const numbered = lines.map((l, i) => `${String(i + 1).padStart(4, " ")}${l}`).join("\n");
    return { content: numbered, lineCount: lines.length };
  }

  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${path}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  const data = (await res.json()) as {
    content?: string;
    encoding?: string;
  };
  const raw = data.content ? Buffer.from(data.content, "base64").toString("utf-8") : "";
  const lines = raw.split("\n");
  const numbered = lines.map((l, i) => `${String(i + 1).padStart(4, " ")}${l}`).join("\n");
  return { content: numbered, lineCount: lines.length };
}

/**
 * Birden çok dosyayı paralel okur.
 */
export async function readRepoFiles(
  ctx: RepoReadCtx,
  paths: string[],
): Promise<Record<string, { content: string; lineCount: number }>> {
  const results = await Promise.allSettled(
    paths.map((p) =>
      readRepoFile(ctx, p).then((r) => ({ path: p, ...r })),
    ),
  );

  const out: Record<string, { content: string; lineCount: number }> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      out[r.value.path] = { content: r.value.content, lineCount: r.value.lineCount };
    }
  }
  return out;
}

/**
 * Bir dosyada regex ile arama yapar. Eşleşen satırları döndürür.
 */
export async function grepRepoFile(
  ctx: RepoReadCtx,
  path: string,
  pattern: string,
  ignoreCase: boolean,
): Promise<string[]> {
  const { content: numbered } = await readRepoFile(ctx, path);
  const lines = numbered.split("\n");
  const regex = new RegExp(pattern, ignoreCase ? "i" : "");
  return lines.filter((l) => regex.test(l));
}
