/**
 * RepoReadCtx — repoyu salt-okunur araçlarla okumak için bağlam.
 * /api/orchestrate ve /api/chat tarafından kullanılır.
 */

export interface RepoReadCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}

/**
 * GitHub API'sinden recursive tree çekip tüm dosya yollarını döndürür.
 */
export async function fetchAllPaths(ctx: RepoReadCtx): Promise<string[]> {
  if (ctx.provider === "gitlab") {
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100`,
      {
        headers: ctx.token
          ? { "PRIVATE-TOKEN": ctx.token, "Content-Type": "application/json" }
          : {},
      },
    );
    if (!res.ok) throw new Error(`GitLab tree hatası: ${res.status}`);
    const data = (await res.json()) as { path: string; type: string }[];
    return data.filter((t) => t.type === "blob").map((t) => t.path);
  }

  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (ctx.token) headers["Authorization"] = `Bearer ${ctx.token}`;

  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers },
  );
  if (!res.ok) throw new Error(`GitHub tree hatası: ${res.status}`);
  const data = (await res.json()) as { tree: { path: string; type: string }[] };
  return data.tree.filter((t) => t.type === "blob").map((t) => t.path);
}

/**
 * Tek bir dosyanın içeriğini çeker (base64 decode eder).
 */
export async function fetchFileContent(
  ctx: RepoReadCtx,
  path: string,
): Promise<string> {
  if (ctx.provider === "gitlab") {
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    const encodedPath = encodeURIComponent(path);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      {
        headers: ctx.token
          ? { "PRIVATE-TOKEN": ctx.token }
          : {},
      },
    );
    if (!res.ok) throw new Error(`GitLab dosya hatası: ${res.status}`);
    return res.text();
  }

  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (ctx.token) headers["Authorization"] = `Bearer ${ctx.token}`;

  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ctx.branch)}`,
    { headers },
  );
  if (!res.ok) throw new Error(`GitHub dosya hatası: ${res.status}`);
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return "";
}
