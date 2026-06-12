/* İşçi-ajanlar (orkestrasyon) için SALT-OKUNUR repo araçları.
   Ayrı modül: çalışan /api/chat akışına dokunmaz (regresyon riski yok).
   Yalnızca okuma/listeleme — yazma/silme YOK (işçiler değiştiremez). */

export interface RepoReadCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}

export interface ReadToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: { type: "object"; properties: Record<string, { type: string; description: string }>; required: string[] };
  };
}

export const READONLY_TOOLS: ReadToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Repo dosya ağacını listeler (yollar).",
      parameters: { type: "object", properties: { filter: { type: "string", description: "Yolda aranacak alt-string (opsiyonel)" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Bir dosyanın içeriğini SATIR NUMARALARIYLA okur.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Repo köküne göre yol" } }, required: ["path"] },
    },
  },
];

export const READONLY_TOOL_NAMES = new Set(READONLY_TOOLS.map((t) => t.function.name));

/** İçeriğe 1'den başlayan satır numaraları ekler (Claude Code 'cat -n' gibi). */
export function withLineNumbers(content: string): string {
  return content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n");
}

function glHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h["PRIVATE-TOKEN"] = token;
  return h;
}
function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "craft-ai-web" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function listFiles(ctx: RepoReadCtx, filter?: string): Promise<string> {
  let paths: string[] = [];
  if (ctx.provider === "gitlab") {
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&per_page=100&ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} — ağaç alınamadı`;
    const data = (await res.json()) as { path: string; type: string }[];
    paths = data.filter((d) => d.type === "blob").map((d) => d.path);
  } else {
    const res = await fetch(
      `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${encodeURIComponent(ctx.branch)}?recursive=1`,
      { headers: ghHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} — ağaç alınamadı`;
    const data = (await res.json()) as { tree?: { path: string; type: string }[] };
    paths = (data.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
  }
  if (filter) paths = paths.filter((p) => p.toLowerCase().includes(filter.toLowerCase()));
  if (paths.length > 300) return paths.slice(0, 300).join("\n") + `\n[... ${paths.length - 300} dosya daha — filtre kullan]`;
  return paths.join("\n") || "(dosya yok)";
}

async function readFile(ctx: RepoReadCtx, path: string): Promise<string> {
  if (ctx.provider === "gitlab") {
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${path})`;
    const text = await res.text();
    return withLineNumbers(text).slice(0, 16_000);
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${path})`;
  const data = (await res.json()) as { content?: string; size?: number };
  if ((data.size ?? 0) > 100_000) return `Hata: dosya çok büyük`;
  const content = Buffer.from(data.content ?? "", "base64").toString("utf-8");
  return withLineNumbers(content).slice(0, 16_000);
}

/** Salt-okunur araç çağrısını yürütür. Bilinmeyen/yazma araçları reddedilir. */
export async function executeReadTool(name: string, args: Record<string, unknown>, ctx: RepoReadCtx): Promise<string> {
  try {
    if (name === "list_files") return await listFiles(ctx, typeof args.filter === "string" ? args.filter : undefined);
    if (name === "read_file") return await readFile(ctx, String(args.path ?? ""));
    return `Bu ajan yalnızca okuma yapabilir; '${name}' kullanılamaz.`;
  } catch (e) {
    return `Hata: ${(e as Error).message}`;
  }
}
