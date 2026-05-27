import type { TreeNode } from "./types";

interface GitHubTreeItem {
  path: string;
  type: string;
}

/** "kullanici/depo" ya da tam GitHub URL'sini owner/repo'ya çevirir. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const v = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const [owner, repo] = v.split("/");
  const valid = /^[a-zA-Z0-9._-]+$/;
  if (!owner || !repo || !valid.test(owner) || !valid.test(repo)) return null;
  return { owner, repo };
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Deponun varsayılan dalını ve özyinelemeli dosya ağacını getirir. */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  token?: string,
): Promise<{ branch: string; items: GitHubTreeItem[] }> {
  const infoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers: ghHeaders(token) },
  );
  const info = await infoRes.json();
  if (!infoRes.ok) throw new Error(info.message || "Depo bulunamadı");

  const branch: string = info.default_branch;
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders(token) },
  );
  const data = await treeRes.json();
  if (!data.tree) throw new Error(data.message || "Dosya ağacı alınamadı");

  return { branch, items: data.tree as GitHubTreeItem[] };
}

/** Tek bir dosyanın ham içeriğini getirir (özel depolar için token kullanılır). */
export async function fetchFileContent(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token?: string,
): Promise<string> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encoded}?ref=${branch}`,
    { headers: { ...ghHeaders(token), Accept: "application/vnd.github.raw" } },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

/** Düz yol listesini iç içe ağaç yapısına dönüştürür. */
export function buildTree(items: GitHubTreeItem[]): TreeNode {
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
