// ── Repo okuma işlemleri (salt-okunur API çağrıları) ──

export interface RepoReadCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}

interface TreeEntry {
  path: string;
  type: "blob" | "tree";
}

interface GrepMatch {
  file: string;
  line: string;
}

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
 * Tüm repo dosya yollarını döndürür.
 */
export async function listAllPaths(ctx: RepoReadCtx): Promise<string[]> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) throw new Error(`GitLab tree: ${res.status}`);
    const data = (await res.json()) as TreeEntry[];
    return data.filter((t) => t.type === "blob").map((t) => t.path);
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) throw new Error(`GitHub tree: ${res.status}`);
  const data = (await res.json()) as { tree: TreeEntry[] };
  return (data.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
}

/**
 * Belirli bir dosyanın içeriğini okur (Base64 çözülmüş).
 */
export async function readFileContent(ctx: RepoReadCtx, path: string): Promise<string> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) throw new Error(`GitLab read: ${res.status}`);
    return await res.text();
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${path}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) throw new Error(`GitHub read: ${res.status}`);
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (data.content && data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  throw new Error("Unexpected GitHub response format");
}

/**
 * Regex ile repo içeriğinde arama yapar.
 * Not: GitHub/GitLab'ın kendi kod arama API'si sınırlıdır; burada basit yaklaşım.
 */
export async function grepContent(
  ctx: RepoReadCtx,
  pattern: string,
  filePattern?: string,
): Promise<GrepMatch[]> {
  // Basit implementasyon: tüm dosyaları listele, uyanları tara
  const allPaths = await listAllPaths(ctx);
  const filtered = filePattern
    ? allPaths.filter((p) => {
        const re = new RegExp(
          "^" +
            filePattern
              .replace(/\./g, "\\.")
              .replace(/\*/g, ".*")
              .replace(/\?/g, ".") +
            "$",
        );
        return re.test(p);
      })
    : allPaths;

  const results: GrepMatch[] = [];
  const re = new RegExp(pattern, "g");
  const maxFiles = 30;

  for (const path of filtered.slice(0, maxFiles)) {
    try {
      const content = await readFileContent(ctx, path);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          results.push({ file: path, line: `${i + 1}: ${lines[i].trim()}` });
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return results;
}
