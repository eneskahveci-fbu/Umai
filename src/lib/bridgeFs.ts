/* İstemci tarafı Hibrit Köprü dosya sistemi istemcisi.

   Ajanların çalıştığı workspace'i (ör. Oracle'daki /opt/craft-bridge/workspace)
   doğrudan tarayıcıdan listeler ve okur — köprünün /fs/list ve /fs/read uçları
   (Bearer token). Köprü CORS'u açık tutar (Access-Control-Allow-Origin: *), bu
   yüzden Vercel'deki siteden çağrı yapılabilir. Sunucu tarafı (chat/route.ts,
   repoRead.ts) bu uçları zaten kullanır; bu modül aynı sözleşmeyi UI için sunar. */

import type { TreeNode, TreeFile } from "./types";

function trimBase(url: string): string {
  return url.replace(/\/$/, "");
}

async function bridgePost(
  url: string,
  token: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${trimBase(url)}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Köprü ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.error === "string") throw new Error(data.error);
  return data;
}

/** Workspace içindeki tüm dosya yollarını döner (yoksayılan dizinler hariç). */
export async function bridgeListFiles(url: string, token: string, filter = ""): Promise<string[]> {
  const data = await bridgePost(url, token, "/fs/list", { filter });
  return Array.isArray(data.paths) ? (data.paths as string[]) : [];
}

/** Tek bir dosyanın içeriğini döner. */
export async function bridgeReadFile(url: string, token: string, path: string): Promise<string> {
  const data = await bridgePost(url, token, "/fs/read", { path });
  return typeof data.content === "string" ? data.content : "";
}

/** Köprü ulaşılabilir mi? /health token gerektirmez. */
export async function bridgeHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${trimBase(url)}/health`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return false;
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return !!d.ok;
  } catch {
    return false;
  }
}

/** Düz yol listesini mevcut TreeNode yapısına dönüştürür (alfabetik sıralı). */
export function buildTreeFromPaths(paths: string[]): TreeNode {
  const root: TreeNode = { dirs: {}, files: [] };
  for (const p of paths) {
    if (!p) continue;
    const parts = p.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      node.dirs[seg] ??= { dirs: {}, files: [] };
      node = node.dirs[seg];
    }
    const name = parts[parts.length - 1];
    if (!node.files.some((f) => f.path === p)) {
      node.files.push({ name, path: p } satisfies TreeFile);
    }
  }
  const sortRec = (n: TreeNode) => {
    n.files.sort((a, b) => a.name.localeCompare(b.name));
    Object.values(n.dirs).forEach(sortRec);
  };
  sortRec(root);
  return root;
}
