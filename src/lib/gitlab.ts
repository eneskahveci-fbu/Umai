import type { TreeNode } from "./types";

interface GitLabTreeItem {
  id: string;
  name: string;
  type: "blob" | "tree";
  path: string;
  mode: string;
}

/** "namespace/repo" ya da tam GitLab URL'sini namespace/repo'ya çevirir. */
export function parseGitLabRepo(input: string): { namespace: string; repo: string } | null {
  const v = input
    .trim()
    .replace(/^https?:\/\/gitlab\.com\//, "")
    .replace(/^gl:/, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const parts = v.split("/");
  if (parts.length < 2) return null;
  const repo = parts[parts.length - 1];
  const namespace = parts.slice(0, parts.length - 1).join("/");
  const valid = /^[a-zA-Z0-9._\-/]+$/;
  if (!namespace || !repo || !valid.test(namespace) || !valid.test(repo)) return null;
  return { namespace, repo };
}

/** "namespace/repo" → URL-encoded project path for GitLab API */
function encodeProject(namespace: string, repo: string) {
  return encodeURIComponent(`${namespace}/${repo}`);
}

function glHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["PRIVATE-TOKEN"] = token;
  return h;
}

/** Deponun varsayılan dalını ve özyinelemeli dosya ağacını getirir. */
export async function fetchGitLabRepoTree(
  namespace: string,
  repo: string,
  token?: string,
): Promise<{ branch: string; items: GitLabTreeItem[] }> {
  const proj = encodeProject(namespace, repo);
  const infoRes = await fetch(
    `https://gitlab.com/api/v4/projects/${proj}`,
    { headers: glHeaders(token) },
  );
  const info = await infoRes.json();
  if (!infoRes.ok) throw new Error(info.message || "Depo bulunamadı");
  const branch: string = info.default_branch || "main";

  const items: GitLabTreeItem[] = [];
  let page = 1;
  while (page <= 10) {
    const treeRes = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(branch)}&per_page=100&page=${page}`,
      { headers: glHeaders(token) },
    );
    if (!treeRes.ok) throw new Error(`Dosya ağacı alınamadı (${treeRes.status})`);
    const data: GitLabTreeItem[] = await treeRes.json();
    if (!Array.isArray(data) || data.length === 0) break;
    items.push(...data);
    const nextPage = treeRes.headers.get("x-next-page");
    if (!nextPage) break;
    page = parseInt(nextPage, 10);
  }

  return { branch, items };
}

/** Tek bir dosyanın ham içeriğini getirir. */
export async function fetchGitLabFileContent(
  namespace: string,
  repo: string,
  branch: string,
  path: string,
  token?: string,
): Promise<string> {
  const proj = encodeProject(namespace, repo);
  const encoded = encodeURIComponent(path);
  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}/raw?ref=${encodeURIComponent(branch)}`,
    { headers: glHeaders(token) },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

/** Depodaki tüm metin dosyalarını paralel olarak getirir (max 50 dosya). */
export async function fetchAllGitLabFiles(
  namespace: string,
  repo: string,
  branch: string,
  items: { path: string; type: string }[],
  token?: string,
  maxFiles = 50,
): Promise<{ path: string; content: string }[]> {
  const textExts = new Set(["ts","tsx","js","jsx","py","go","rs","java","c","cpp","h","css","scss","html","json","md","yaml","yml","toml","sh","sql","rb","php","swift","kt","xml","txt"]);
  const blobs = items
    .filter((i) => i.type === "blob")
    .filter((i) => {
      const ext = i.path.split(".").pop()?.toLowerCase() ?? "";
      const name = i.path.split("/").pop()?.toLowerCase() ?? "";
      return textExts.has(ext) || name === ".env.example" || name === "dockerfile" || name === "makefile";
    })
    .filter((i) => !i.path.includes("node_modules") && !i.path.includes(".git") && !i.path.includes("dist/") && !i.path.includes("build/"))
    .slice(0, maxFiles);

  const results = await Promise.allSettled(
    blobs.map((b) =>
      fetchGitLabFileContent(namespace, repo, branch, b.path, token).then((content) => ({ path: b.path, content }))
    ),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<{ path: string; content: string }> => r.status === "fulfilled")
    .map((r) => r.value);
}

/** Düz yol listesini iç içe ağaç yapısına dönüştürür. */
export function buildGitLabTree(items: GitLabTreeItem[]): TreeNode {
  const root: TreeNode = { dirs: {}, files: [] };
  for (const it of items) {
    if (it.type !== "blob" && it.type !== "tree") continue;
    const parts = it.path.split("/");
    let node = root;
    parts.forEach((part, idx) => {
      const last = idx === parts.length - 1;
      if (last && it.type === "blob") {
        node.files.push({ name: part, path: it.path });
      } else {
        node.dirs[part] ??= { dirs: {}, files: [] };
        node = node.dirs[part];
      }
    });
  }
  return root;
}

/** Repo URL'sinin GitLab olup olmadığını kontrol eder. */
export function isGitLabRepo(repoStr: string): boolean {
  return (
    repoStr.includes("gitlab.com") ||
    repoStr.startsWith("gl:")
  );
}
