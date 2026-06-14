import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";
import { PLATFORM_KNOWLEDGE } from "@/lib/platform-knowledge";
import { buildContextSections } from "@/lib/prompt";
import { runReadOnlyAgent } from "@/lib/subagent";
import { filterByGlob } from "@/lib/glob";
import { pruneMessages } from "@/lib/contextWindow";
import { detectFrameworks, extractDeps, parseGitignore } from "@/lib/projectContext";
import { CODER_TOOLS } from "@/lib/tools";
import { EXTENSION_TOOLS } from "@/lib/extensions/registry";
import { searchWeb, formatResults, fetchUrl } from "@/lib/webSearch";
import type { ChatMessage, MemoryItem, Provider, ResponseStyle } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RepoCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}

interface SkillPayload {
  title: string;
  content: string;
  tags?: string[];
  source?: "manual" | "file";
  fileName?: string;
}

interface McpServerConfig {
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

interface ChatRequest {
  messages: (ChatMessage | { role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string })[];
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillPayload[];
  searchContext?: string;
  projectPrompt?: string;
  tools?: boolean;
  webSearch?: boolean;
  requireWriteApproval?: boolean;
  safeMode?: boolean;
  toolPermissions?: Record<string, boolean>;
  planApprovalMode?: boolean;
  planApproved?: boolean;
  blockNetworkTools?: boolean;
  /** İstemcide terminal (uzak WS veya WebContainer) mevcutsa true → run_command
      aracı ajana sunulur. Aksi halde araç gizlenir (çıktısız komut = takılma). */
  terminalAvailable?: boolean;
  repoCtx?: RepoCtx;
  mcpServers?: McpServerConfig[];
}

const rl = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  if (ip === "unknown" || ip === "::1" || ip === "127.0.0.1") return true;
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.reset) { rl.set(ip, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= 120) return false;
  e.count++;
  return true;
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* ── Tool execution ── */

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

/* Repo'daki tüm dosya yollarını döndürür (glob/grep/list_files ortak kullanır). */
async function getAllPaths(ctx: RepoCtx): Promise<string[]> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
    const data = await res.json() as { path: string; type: string }[];
    return data.filter((t) => t.type === "blob").map((t) => t.path);
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
  const data = await res.json() as { tree?: { path: string; type: string }[] };
  return (data.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
}

async function execListFiles(ctx: RepoCtx, args: { filter?: string }): Promise<string> {
  let items: string[];
  try { items = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
  const filter = args.filter?.toLowerCase();
  if (filter) items = items.filter((p) => p.toLowerCase().includes(filter));
  if (items.length > 200) {
    return items.slice(0, 200).join("\n") + `\n\n[${items.length - 200} dosya daha gizlendi — filtre kullan]`;
  }
  return items.join("\n") || "(eşleşen dosya yok)";
}

/* glob: '**' dahil yıldızlı desenle dosya bul. */
async function execGlob(ctx: RepoCtx, args: { pattern: string }): Promise<string> {
  if (!args.pattern) return "Hata: pattern zorunlu";
  let items: string[];
  try { items = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
  const matched = filterByGlob(items, args.pattern);
  if (matched.length === 0) return "(eşleşen dosya yok)";
  if (matched.length > 200) return matched.slice(0, 200).join("\n") + `\n\n[${matched.length - 200} daha]`;
  return matched.join("\n");
}

/* grep: regex ile dosya içeriklerinde ara → dosya:satır eşleşmeleri. */
async function execGrep(ctx: RepoCtx, args: { pattern: string; glob?: string; ignore_case?: boolean | string }, cache?: Map<string, string>): Promise<string> {
  if (!args.pattern) return "Hata: pattern zorunlu";
  let re: RegExp;
  try { re = new RegExp(args.pattern, (args.ignore_case === true || args.ignore_case === "true") ? "i" : ""); }
  catch (e) { return `Hata: geçersiz regex: ${(e as Error).message}`; }
  let paths: string[];
  try { paths = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
  if (args.glob) paths = filterByGlob(paths, args.glob);
  const MAX_FILES = 60;
  const capped = paths.slice(0, MAX_FILES);
  const out: string[] = [];
  let matches = 0;
  for (const p of capped) {
    const r = await getFileRaw(ctx, p, cache);
    if (!r.ok) continue;
    const lines = r.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        out.push(`${p}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
        if (++matches >= 100) break;
      }
    }
    if (matches >= 100) break;
  }
  let res = out.join("\n") || "(eşleşme yok)";
  if (paths.length > MAX_FILES) res += `\n\n[Not: ${paths.length} dosyadan ilk ${MAX_FILES}'i tarandı — 'glob' ile daralt]`;
  return res;
}

/* read_files: birden çok dosyayı tek çağrıda, satır numaralı oku. */
async function execReadFiles(ctx: RepoCtx, args: { paths: string[] | string }, cache?: Map<string, string>): Promise<string> {
  let paths: string[] = Array.isArray(args.paths)
    ? args.paths
    : typeof args.paths === "string" ? args.paths.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [];
  if (paths.length === 0) return "Hata: paths zorunlu (dizi veya virgülle ayrılmış yollar)";
  paths = paths.slice(0, 10);
  const parts: string[] = [];
  for (const p of paths) {
    const r = await getFileRaw(ctx, p, cache);
    if (!r.ok) { parts.push(`### ${p}\n${r.error}`); continue; }
    const numbered = r.content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n").slice(0, 8000);
    parts.push(`### ${p}\n${numbered}`);
  }
  return parts.join("\n\n");
}

/* Bir dosyanın TAM ham içeriğini getirir (kırpma yok). read_file ve str_replace
   ortak kullanır. İstek başına `cache` ile aynı dosya iki kez çekilmez. */
async function getFileRaw(
  ctx: RepoCtx,
  path: string,
  cache?: Map<string, string>,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  if (cache?.has(path)) return { ok: true, content: cache.get(path)! };
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const encoded = encodeURIComponent(path);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return { ok: false, error: `Hata: ${res.status} — dosya bulunamadı (${path})` };
    const text = await res.text();
    cache?.set(path, text);
    return { ok: true, content: text };
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return { ok: false, error: `Hata: ${res.status} — dosya bulunamadı (${path})` };
  const data = await res.json();
  if (data.size > 100_000) return { ok: false, error: `Hata: dosya çok büyük (${data.size} bayt). 100KB üstü desteklenmiyor.` };
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  cache?.set(path, content);
  return { ok: true, content };
}

/* read_file: içeriği SATIR NUMARALARIYLA döner (Claude Code gibi) — modelin
   düzenlemede satıra atıfta bulunmasını ve isabetini artırır. */
async function execReadFile(ctx: RepoCtx, args: { path: string }, cache?: Map<string, string>): Promise<string> {
  if (!args.path) return "Hata: path boş";
  const r = await getFileRaw(ctx, args.path, cache);
  if (!r.ok) return r.error;
  const lines = r.content.split("\n");
  const numbered = lines.map((l, i) => `${i + 1}\t${l}`).join("\n");
  if (numbered.length > 20_000) {
    return numbered.slice(0, 20_000) + "\n\n[... kısaltıldı — belirli bir bölgeyi görmek için search_code kullan]";
  }
  return numbered;
}

/* str_replace: hedefli düzenleme. old_string birebir + benzersiz eşleşmeli. */
async function execStrReplace(
  ctx: RepoCtx,
  args: { path: string; old_string: string; new_string: string; commit_message?: string; replace_all?: boolean | string },
  cache?: Map<string, string>,
  writeBuffer?: Map<string, WriteEntry>,
): Promise<string> {
  if (!args.path || args.old_string == null || args.new_string == null) {
    return "Hata: path, old_string ve new_string zorunlu";
  }
  if (args.old_string === args.new_string) return "Hata: old_string ve new_string aynı — değişiklik yok";
  const r = await getFileRaw(ctx, args.path, cache);
  if (!r.ok) return r.error;
  const content = r.content;
  const replaceAll = args.replace_all === true || args.replace_all === "true";

  /* Tolerans: model read_file'dan gelen "42<TAB>kod" satır numarası önekini
     yanlışlıkla old_string'e kopyarsa, önekleri soyup tekrar dene. */
  let oldStr = args.old_string;
  if (content.split(oldStr).length - 1 === 0) {
    const stripped = oldStr.split("\n").map((l) => l.replace(/^\s*\d+\t/, "")).join("\n");
    if (stripped !== oldStr && content.split(stripped).length - 1 >= 1) oldStr = stripped;
  }

  const occurrences = content.split(oldStr).length - 1;
  if (occurrences === 0) {
    return `Hata: old_string '${args.path}' içinde bulunamadı. Önce read_file ile mevcut metni kontrol et (satır numarası ve baştaki '<sayı><TAB>' olmadan, birebir kopyala).`;
  }
  if (occurrences > 1 && !replaceAll) {
    return `Hata: old_string ${occurrences} kez eşleşti. Benzersiz olması için daha fazla bağlam ekle ya da replace_all:true kullan.`;
  }
  let updated: string;
  if (replaceAll) {
    updated = content.split(oldStr).join(args.new_string);
  } else {
    const idx = content.indexOf(oldStr);
    updated = content.slice(0, idx) + args.new_string + content.slice(idx + oldStr.length);
  }
  const msg = args.commit_message || `chore: update ${args.path}`;
  const writeRes = await execWriteFile(ctx, { path: args.path, content: updated, commit_message: msg }, cache, writeBuffer);
  if (writeRes.startsWith("Hata")) return writeRes;
  cache?.set(args.path, updated); // önbelleği güncel tut
  return `✅ ${args.path}: ${replaceAll ? occurrences + " eşleşme" : "1 eşleşme"} değiştirildi. ${writeRes}`;
}

/* create_pr: head → base PR (GitHub) / MR (GitLab) açar. */
async function execCreatePR(ctx: RepoCtx, args: { title: string; head: string; base: string; body?: string }): Promise<string> {
  if (!args.title || !args.head || !args.base) return "Hata: title, head ve base zorunlu";
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/merge_requests`, {
      method: "POST",
      headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ source_branch: args.head, target_branch: args.base, title: args.title, description: args.body || "" }),
    });
    if (!res.ok) return `Hata: ${res.status} — ${(await res.text().catch(() => "")).slice(0, 200)}`;
    const d = await res.json() as { web_url?: string; iid?: number };
    return `✅ MR !${d.iid} oluşturuldu: ${d.web_url}`;
  }
  const res = await fetch(`https://api.github.com/repos/${ctx.owner}/${ctx.repo}/pulls`, {
    method: "POST",
    headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
    body: JSON.stringify({ title: args.title, body: args.body || "", head: args.head, base: args.base }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { message?: string };
    return `Hata: ${res.status} — ${e.message || ""}`;
  }
  const d = await res.json() as { html_url?: string; number?: number };
  return `✅ PR #${d.number} oluşturuldu: ${d.html_url}`;
}

async function execSearchFiles(ctx: RepoCtx, args: { query: string }): Promise<string> {
  if (!args.query) return "Hata: query boş";
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json();
    const q = args.query.toLowerCase();
    const matches = (data as { path: string; type: string }[])
      .filter((t) => t.type === "blob" && t.path.toLowerCase().includes(q))
      .map((t) => t.path)
      .slice(0, 50);
    return matches.length ? matches.join("\n") : "(eşleşme yok)";
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json();
  const q = args.query.toLowerCase();
  const matches = (data.tree as { path: string; type: string }[])
    .filter((t) => t.type === "blob" && t.path.toLowerCase().includes(q))
    .map((t) => t.path)
    .slice(0, 50);
  return matches.length ? matches.join("\n") : "(eşleşme yok)";
}

async function execSearchCode(ctx: RepoCtx, args: { query: string; extension?: string }): Promise<string> {
  if (!args.query) return "Hata: query boş";
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const q = encodeURIComponent(args.query);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/search?scope=blobs&search=${q}&ref=${encodeURIComponent(ctx.branch)}&per_page=20`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { filename: string; path: string; data: string; startline: number }[];
    if (!data.length) return "(eşleşme yok)";
    return data
      .filter((r) => !args.extension || r.path.endsWith(`.${args.extension}`))
      .slice(0, 15)
      .map((r) => `${r.path}:${r.startline}\n  ${r.data.trim().slice(0, 120)}`)
      .join("\n\n");
  }
  const q = encodeURIComponent(`${args.query} repo:${ctx.owner}/${ctx.repo}${args.extension ? ` extension:${args.extension}` : ""}`);
  const res = await fetch(`https://api.github.com/search/code?q=${q}&per_page=15`, {
    headers: { ...ghHeaders(ctx.token), Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
  const data = await res.json() as { items?: { path: string; html_url: string }[] };
  if (!data.items?.length) return "(eşleşme yok)";
  return data.items.map((r) => r.path).join("\n");
}

type WriteEntry = { content: string; isNew: boolean };

/* Bir turun tüm dosya yazımlarını tek Git commit olarak kaydeder.
   GitLab: /api/v4/projects/{id}/repository/commits (actions array)
   GitHub: blob + tree + commit + ref-update (atomic tree API) */
async function flushAtomicCommit(
  ctx: RepoCtx,
  writes: Map<string, WriteEntry>,
  commitMessage: string,
): Promise<string> {
  if (writes.size === 0) return "Değişiklik yok";

  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const actions = [...writes.entries()].map(([path, { content, isNew }]) => ({
      action: isNew ? "create" : "update",
      file_path: path,
      content: Buffer.from(content, "utf-8").toString("base64"),
      encoding: "base64",
    }));
    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/commits`, {
      method: "POST",
      headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ branch: ctx.branch, commit_message: commitMessage, actions }),
    });
    if (!res.ok) return `Hata: ${res.status} — ${(await res.text().catch(() => "")).slice(0, 200)}`;
    const d = await res.json() as { short_id?: string };
    return `✅ ${writes.size} dosya tek commit'te kaydedildi (${d.short_id ?? "?"})`;
  }

  /* GitHub: tree API — atomik */
  const refRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/ref/heads/${encodeURIComponent(ctx.branch)}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!refRes.ok) return `Hata: branch ref alınamadı (${refRes.status})`;
  const baseSha = ((await refRes.json()) as { object?: { sha: string } }).object?.sha;
  if (!baseSha) return "Hata: branch SHA alınamadı";

  /* Create blobs for each file */
  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const [path, { content }] of writes.entries()) {
    const blobRes = await fetch(
      `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/blobs`,
      {
        method: "POST",
        headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
        body: JSON.stringify({ content: Buffer.from(content, "utf-8").toString("base64"), encoding: "base64" }),
      },
    );
    if (!blobRes.ok) return `Hata: blob oluşturulamadı (${path}, ${blobRes.status})`;
    const { sha } = await blobRes.json() as { sha: string };
    treeItems.push({ path, mode: "100644", type: "blob", sha });
  }

  /* Create tree */
  const treeRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees`,
    {
      method: "POST",
      headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
    },
  );
  if (!treeRes.ok) return `Hata: tree oluşturulamadı (${treeRes.status})`;
  const { sha: treeSha } = await treeRes.json() as { sha: string };

  /* Create commit */
  const commitRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/commits`,
    {
      method: "POST",
      headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ message: commitMessage, tree: treeSha, parents: [baseSha] }),
    },
  );
  if (!commitRes.ok) return `Hata: commit oluşturulamadı (${commitRes.status})`;
  const { sha: commitSha } = await commitRes.json() as { sha: string };

  /* Update ref */
  const updateRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/refs/heads/${encodeURIComponent(ctx.branch)}`,
    {
      method: "PATCH",
      headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitSha }),
    },
  );
  if (!updateRes.ok) return `Hata: ref güncellenemedi (${updateRes.status})`;
  return `✅ ${writes.size} dosya tek commit'te kaydedildi (${commitSha.slice(0, 7)})`;
}

async function execWriteFile(
  ctx: RepoCtx,
  args: { path: string; content: string; commit_message: string },
  cache?: Map<string, string>,
  writeBuffer?: Map<string, WriteEntry>,
): Promise<string> {
  if (!args.path || !args.content) return "Hata: path ve content zorunlu";
  const msg = args.commit_message || `chore: update ${args.path}`;

  /* Toplu commit modu: dosyayı buffer'a ekle, cache'i güncelle, commit yapma. */
  if (writeBuffer) {
    const isNew = !cache?.has(args.path);
    cache?.set(args.path, args.content);
    writeBuffer.set(args.path, { content: args.content, isNew });
    return `✅ ${args.path} ${isNew ? "oluşturuldu" : "güncellendi"} (toplu commit bekleniyor)`;
  }

  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const encoded = encodeURIComponent(args.path);
    /* check if file exists */
    const check = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    const method = check.ok ? "PUT" : "POST";
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}`,
      {
        method,
        headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
        body: JSON.stringify({ branch: ctx.branch, content: args.content, commit_message: msg, encoding: "text" }),
      },
    );
    if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
    return `✅ ${args.path} başarıyla ${method === "PUT" ? "güncellendi" : "oluşturuldu"} (branch: ${ctx.branch})`;
  }
  /* GitHub: get existing SHA for update */
  const checkRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(args.path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  const sha = checkRes.ok ? ((await checkRes.json()) as { sha?: string }).sha : undefined;
  const content64 = Buffer.from(args.content, "utf-8").toString("base64");
  const body: Record<string, unknown> = { message: msg, content: content64, branch: ctx.branch };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(args.path)}`,
    { method: "PUT", headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
  return `✅ ${args.path} başarıyla ${sha ? "güncellendi" : "oluşturuldu"} (branch: ${ctx.branch})`;
}

async function execListBranches(ctx: RepoCtx): Promise<string> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/branches?per_page=30`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { name: string; default?: boolean }[];
    return data.map((b) => `${b.name}${b.default ? " (varsayılan)" : ""}`).join("\n");
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/branches?per_page=30`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json() as { name: string }[];
  return data.map((b) => b.name).join("\n");
}

async function execCreateBranch(ctx: RepoCtx, args: { name: string; from?: string }): Promise<string> {
  const sourceBranch = args.from || ctx.branch;
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/branches`, {
      method: "POST",
      headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ branch: args.name, ref: sourceBranch }),
    });
    if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
    return `✅ Dal oluşturuldu: ${args.name} (kaynak: ${sourceBranch})`;
  }
  /* GitHub: get source SHA */
  const refRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/ref/heads/${encodeURIComponent(sourceBranch)}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!refRes.ok) return `Hata: kaynak dal bulunamadı (${sourceBranch})`;
  const refData = await refRes.json() as { object?: { sha: string } };
  const sha = refData.object?.sha;
  if (!sha) return "Hata: kaynak dal SHA alınamadı";
  const res = await fetch(`https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/refs`, {
    method: "POST",
    headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${args.name}`, sha }),
  });
  if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
  return `✅ Dal oluşturuldu: ${args.name} (kaynak: ${sourceBranch})`;
}

async function execGetCommitHistory(ctx: RepoCtx, args: { limit?: string; path?: string }): Promise<string> {
  const limit = Math.min(30, parseInt(args.limit ?? "10", 10) || 10);
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const pathQ = args.path ? `&path=${encodeURIComponent(args.path)}` : "";
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/commits?ref_name=${encodeURIComponent(ctx.branch)}&per_page=${limit}${pathQ}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { short_id: string; title: string; author_name: string; created_at: string }[];
    return data.map((c) => `${c.short_id} ${c.created_at.slice(0, 10)} [${c.author_name}] ${c.title}`).join("\n");
  }
  const pathQ = args.path ? `&path=${encodeURIComponent(args.path)}` : "";
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/commits?sha=${ctx.branch}&per_page=${limit}${pathQ}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json() as { sha: string; commit: { message: string; author: { name: string; date: string } } }[];
  return data.map((c) => `${c.sha.slice(0, 7)} ${c.commit.author.date.slice(0, 10)} [${c.commit.author.name}] ${c.commit.message.split("\n")[0]}`).join("\n");
}

/* SOUL.md / .craft.md — OpenClaw-inspired project context file */
async function fetchSoulFile(ctx: RepoCtx): Promise<string | null> {
  const candidates = ["SOUL.md", ".craft.md", ".craftai.md", "AGENTS.md"];
  for (const candidate of candidates) {
    try {
      if (ctx.provider === "gitlab") {
        const proj = encodeGlProject(ctx.owner, ctx.repo);
        const encoded = encodeURIComponent(candidate);
        const res = await fetch(
          `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}/raw?ref=${encodeURIComponent(ctx.branch)}`,
          { headers: glHeaders(ctx.token) },
        );
        if (res.ok) return await res.text();
      } else {
        const res = await fetch(
          `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${candidate}?ref=${ctx.branch}`,
          { headers: ghHeaders(ctx.token) },
        );
        if (res.ok) {
          const data = await res.json() as { content: string };
          return Buffer.from(data.content, "base64").toString("utf-8");
        }
      }
    } catch { /* devam et */ }
  }
  return null;
}

async function fetchMcpTools(server: McpServerConfig): Promise<{ name: string; description: string; parameters: object }[]> {
  try {
    const res = await fetch(`${server.url}/tools/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { result?: { tools?: { name: string; description: string; inputSchema?: object }[] } };
    return (data?.result?.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema ?? { type: "object", properties: {}, required: [] },
    }));
  } catch { return []; }
}

async function callMcpTool(server: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    const res = await fetch(`${server.url}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: args } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `MCP hata: ${res.status}`;
    const data = await res.json() as { result?: { content?: { type: string; text?: string }[] } };
    return (data?.result?.content ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n") || "Sonuç yok";
  } catch (e) { return `MCP hata: ${(e as Error).message}`; }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: RepoCtx,
  mcpServers?: McpServerConfig[],
  cache?: Map<string, string>,
  writeBuffer?: Map<string, WriteEntry>,
): Promise<string> {
  try {
    if (!ctx && ["list_files","read_file","read_files","glob","grep","search_files","search_code","write_file","str_replace","list_branches","create_branch","create_pr","get_commit_history","git_diff","git_log","git_blame","discover_rules","trigger_ci"].includes(name))
      return "Hata: repo bağlı değil. Kullanıcıya bir repo bağlamasını söyle.";
    if (name === "list_files") return await execListFiles(ctx!, args as { filter?: string });
    if (name === "glob") return await execGlob(ctx!, args as { pattern: string });
    if (name === "grep") return await execGrep(ctx!, args as { pattern: string; glob?: string; ignore_case?: boolean | string }, cache);
    if (name === "read_files") return await execReadFiles(ctx!, args as { paths: string[] | string }, cache);
    if (name === "read_file") return await execReadFile(ctx!, args as { path: string }, cache);
    if (name === "search_files") return await execSearchFiles(ctx!, args as { query: string });
    if (name === "search_code") return await execSearchCode(ctx!, args as { query: string; extension?: string });
    if (name === "str_replace") return await execStrReplace(ctx!, args as { path: string; old_string: string; new_string: string; commit_message?: string; replace_all?: boolean | string }, cache, writeBuffer);
    if (name === "write_file") {
      const res = await execWriteFile(ctx!, args as { path: string; content: string; commit_message: string }, cache, writeBuffer);
      if (!res.startsWith("Hata") && typeof args.path === "string" && typeof args.content === "string" && !writeBuffer) {
        cache?.set(args.path, args.content); // önbelleği güncel tut (buffer yoksa)
      }
      return res;
    }
    if (name === "list_branches") return await execListBranches(ctx!);
    if (name === "create_branch") return await execCreateBranch(ctx!, args as { name: string; from?: string });
    if (name === "create_pr") return await execCreatePR(ctx!, args as { title: string; head: string; base: string; body?: string });
    if (name === "get_commit_history") return await execGetCommitHistory(ctx!, args as { limit?: string; path?: string });
    /* ── Extension araçları (DeepSeek): git diff/log/blame, kural keşfi, CI ── */
    if (name === "git_diff") {
      const base = String(args.base ?? ""); const head = String(args.head ?? "");
      if (!base || !head) return "Hata: base ve head zorunlu.";
      try {
        if (ctx!.provider === "gitlab") {
          const proj = encodeGlProject(ctx!.owner, ctx!.repo);
          const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`, { headers: glHeaders(ctx!.token) });
          if (!res.ok) return `Hata: ${res.status}`;
          const data = await res.json() as { diffs?: { old_path: string; new_path: string; diff: string }[] };
          return (data.diffs ?? []).map((d) => `--- ${d.old_path}\n+++ ${d.new_path}\n${d.diff}`).join("\n").slice(0, 8000) || "Fark yok.";
        }
        const res = await fetch(`https://api.github.com/repos/${ctx!.owner}/${ctx!.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, { headers: { ...ghHeaders(ctx!.token), Accept: "application/vnd.github.diff" } });
        if (!res.ok) return `Hata: ${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`;
        return (await res.text()).slice(0, 8000) || "Fark yok.";
      } catch (e) { return `Hata: ${(e as Error).message}`; }
    }
    if (name === "git_log" || name === "git_blame") {
      const branch = String(args.branch ?? ctx!.branch);
      const path = args.path ? String(args.path) : "";
      const limit = Math.min(30, Math.max(1, Number(args.limit) || 10));
      const blameNote = name === "git_blame" ? "[Basitleştirilmiş blame: dosyayı etkileyen son commit'ler]\n" : "";
      try {
        if (ctx!.provider === "gitlab") {
          const proj = encodeGlProject(ctx!.owner, ctx!.repo);
          const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=${limit}${path ? `&path=${encodeURIComponent(path)}` : ""}`, { headers: glHeaders(ctx!.token) });
          if (!res.ok) return `Hata: ${res.status}`;
          const data = await res.json() as { short_id: string; title: string; author_name: string; created_at: string }[];
          return blameNote + (data.map((c) => `${c.short_id} ${c.created_at.slice(0, 10)} ${c.author_name}: ${c.title}`).join("\n") || "Commit yok.");
        }
        const res = await fetch(`https://api.github.com/repos/${ctx!.owner}/${ctx!.repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}${path ? `&path=${encodeURIComponent(path)}` : ""}`, { headers: ghHeaders(ctx!.token) });
        if (!res.ok) return `Hata: ${res.status}`;
        const data = await res.json() as { sha: string; commit: { message: string; author: { name: string; date: string } } }[];
        return blameNote + (data.map((c) => `${c.sha.slice(0, 7)} ${c.commit.author.date.slice(0, 10)} ${c.commit.author.name}: ${c.commit.message.split("\n")[0]}`).join("\n") || "Commit yok.");
      } catch (e) { return `Hata: ${(e as Error).message}`; }
    }
    if (name === "discover_rules") {
      const candidates = ["CLAUDE.md", "AGENTS.md", ".rules", ".cursorrules", ".craft.md", ".craftai.md", "SOUL.md", ".github/copilot-instructions.md"];
      const out: string[] = [];
      for (const f of candidates) {
        const r = await getFileRaw(ctx!, f, cache);
        if (r.ok && r.content.trim()) out.push(`### ${f}\n${r.content.slice(0, 3000)}`);
      }
      return out.length ? out.join("\n\n") : "Davranış kuralı dosyası bulunamadı (CLAUDE.md, AGENTS.md, .rules, .cursorrules vb.).";
    }
    if (name === "trigger_ci") {
      const workflow = String(args.workflow ?? "");
      const ref = String(args.ref ?? ctx!.branch);
      if (!workflow) return "Hata: workflow zorunlu.";
      if (ctx!.provider === "gitlab") return "GitLab CI tetikleme için ayrı bir trigger token gerekir (şu an desteklenmiyor).";
      try {
        const res = await fetch(`https://api.github.com/repos/${ctx!.owner}/${ctx!.repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
          method: "POST",
          headers: { ...ghHeaders(ctx!.token), "Content-Type": "application/json" },
          body: JSON.stringify({ ref, ...(args.inputs && typeof args.inputs === "object" ? { inputs: args.inputs } : {}) }),
        });
        if (res.status === 204) return `✅ Workflow '${workflow}' tetiklendi (ref: ${ref}).`;
        return `Hata: ${res.status} ${(await res.text().catch(() => "")).slice(0, 150)}`;
      } catch (e) { return `Hata: ${(e as Error).message}`; }
    }
    if (name === "web_search") {
      const query = String(args.query ?? "");
      if (!query.trim()) return "Arama sorgusu boş.";
      return formatResults(await searchWeb(query));
    }
    if (name === "read_url") {
      return await fetchUrl(String(args.url ?? ""));
    }
    /* Try MCP servers for unknown tools */
    for (const srv of (mcpServers ?? [])) {
      if (!srv.enabled) continue;
      const result = await callMcpTool(srv, name, args);
      if (!result.startsWith("MCP hata:")) return result;
    }
    return `Bilinmeyen araç: ${name}`;
  } catch (e) {
    return `Hata: ${(e as Error).message}`;
  }
}

/* ── Stream parser helpers ── */

interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

interface RoundResult {
  content: string;
  toolCalls: AccumulatedToolCall[];
  finishReason: string | null;
  /** Sağlayıcının bildirdiği GERÇEK token kullanımı (varsa). */
  usage: { prompt: number; completion: number } | null;
}

async function streamRound(
  upstream: Response,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
): Promise<RoundResult> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls: AccumulatedToolCall[] = [];
  let finishReason: string | null = null;
  let usage: { prompt: number; completion: number } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          content += delta.content;
          /* forward content deltas */
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`),
          );
        }
        /* Reasoning/düşünme token'larını da ilet (DeepSeek-R1: reasoning_content,
           OpenRouter/o-serisi: reasoning). İstemci bunu "Düşünce süreci"
           panelinde gösterir. */
        const reasoningDelta: string | undefined = delta?.reasoning ?? delta?.reasoning_content;
        if (reasoningDelta) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning: reasoningDelta } }] })}\n\n`),
          );
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let acc = toolCalls.find((c) => c.index === idx);
            if (!acc) {
              acc = { index: idx, id: tc.id || `call_${idx}`, name: "", arguments: "" };
              toolCalls.push(acc);
            }
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        /* OpenAI-uyumlu akışta usage son chunk'ta gelir (stream_options.include_usage).
           Anthropic stili: message_delta.usage. İkisini de yakala. */
        if (json.usage) {
          const p = Number(json.usage.prompt_tokens ?? json.usage.input_tokens ?? 0);
          const c = Number(json.usage.completion_tokens ?? json.usage.output_tokens ?? 0);
          if (p || c) usage = { prompt: p, completion: c };
        }
      } catch {
        /* parçalı satır */
      }
    }
  }
  return { content, toolCalls, finishReason, usage };
}

function friendlyApiError(status: number, rawDetail: string, ctx?: { model?: string; provider?: string }): string {
  const tag = ctx?.model || ctx?.provider ? ` [${ctx.provider ?? ""}${ctx.provider && ctx.model ? " / " : ""}${ctx.model ?? ""}]` : "";
  let providerMsg = "";
  try {
    const json = JSON.parse(rawDetail);
    providerMsg = json?.error?.message || json?.message || "";
  } catch { /* raw text */ }
  const low = providerMsg.toLowerCase();

  if (low.includes("insufficient balance") || low.includes("quota") || low.includes("resource exhausted") || status === 402)
    return `💳 Yetersiz bakiye${tag}: Sağlayıcı hesabına kredi yükle veya ödeme yöntemini ekle.`;
  if (low.includes("invalid api key") || low.includes("unauthorized") || low.includes("authentication") || low.includes("permission denied") || status === 401)
    return `🔑 API anahtarı geçersiz${tag}: Ayarlar → Modeller'den anahtarı kontrol et. Anahtarın doğru sağlayıcıya ait olduğundan emin ol.`;
  if (low.includes("rate limit") || low.includes("too many") || status === 429)
    return `⏱️ İstek limiti aşıldı${tag}: 30-60 saniye bekle ve tekrar dene.`;
  if (low.includes("model") && (low.includes("not found") || low.includes("does not exist") || low.includes("decommissioned") || low.includes("unknown"))) {
    return `🚫 Model bulunamadı${tag}: Bu model artık desteklenmiyor veya yanlış yazılmış. Ayarlar'dan farklı bir model seç.`;
  }
  if (status === 400 || status === 404) {
    const hint = providerMsg ? `\n\nDetay: ${providerMsg.slice(0, 200)}` : "";
    return `⚠️ Geçersiz istek (${status})${tag}: Model adı, baseUrl veya sağlayıcı yanlış olabilir.${hint}`;
  }
  if (status === 403) {
    const raw = rawDetail.toLowerCase();
    if (raw.includes("host") && raw.includes("allow"))
      return `🌍 Sağlayıcı bu sunucudan istek kabul etmiyor${tag}: Bu, yerel IP/proxy engelidir; canlı deployment'tan (Vercel) çalışır.`;
    if (raw.includes("api key") || raw.includes("auth") || low.includes("api key") || low.includes("auth"))
      return `🔑 API anahtarı geçersiz${tag}: Anahtarın doğru ve aktif olduğunu kontrol et.`;
    return `🚷 Erişim reddedildi${tag}: Anahtar geçersiz veya modele erişim izni yok (bazı modeller plan/onay gerektirir).`;
  }
  if (status >= 500)
    return `🛠️ Sağlayıcı sunucu hatası (${status})${tag}: Kısa süre sonra tekrar dene.`;
  if (providerMsg) return `Sağlayıcı hatası (${status})${tag}: ${providerMsg.slice(0, 300)}`;
  return `Sağlayıcı hatası (${status})${tag}: ${rawDetail.slice(0, 200)}`;
}

export async function POST(req: Request) {
  if (!checkOrigin(req)) return new Response("Geçersiz origin.", { status: 403 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || req.headers.get("cf-connecting-ip")?.trim()
    || "unknown";

  if (!checkRate(ip)) return new Response("İstek limiti aşıldı (120 req/min). Lütfen biraz bekle.", { status: 429 });

  let body: ChatRequest;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek gövdesi", { status: 400 }); }

  const baseUrl = (body.baseUrl || process.env.LLM_BASE_URL || "https://router.huggingface.co/v1").replace(/\/$/, "");
  const model = body.model || process.env.LLM_MODEL || "";
  const apiKey = body.apiKey || process.env.LLM_API_KEY || "";
  const provider = body.provider || "hf";

  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  /* pollinations ve ollama API anahtarı gerektirmez */
  if (!apiKey && provider !== "pollinations" && provider !== "ollama") return new Response("API anahtarı yok.", { status: 400 });

  /* Proje-başına örnekleme parametreleri (temperature/max_tokens). Tanımsızsa
     sağlayıcı varsayılanı kullanılır. max_tokens için cömert bir varsayılan
     veririz; aksi halde çoğu sağlayıcı yanıtı ~2-4K token'da keser ve kullanıcı
     sürekli "Devam et" tıklamak zorunda kalır (Claude Code'da uzun yanıtlar). */
  const sampling: Record<string, unknown> = {};
  if (typeof body.temperature === "number") sampling.temperature = body.temperature;
  sampling.max_tokens = typeof body.maxTokens === "number" && body.maxTokens > 0 ? body.maxTokens : 8192;

  const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "anthropic") {
    upstreamHeaders["anthropic-version"] = "2023-06-01";
    upstreamHeaders["x-api-key"] = apiKey;
  } else if (apiKey) {
    upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;
  }

  if (provider === "openrouter") {
    upstreamHeaders["HTTP-Referer"] = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app";
    upstreamHeaders["X-Title"] = "Craft.Coder";
  }

  let sysPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  /* Eklenen her model, içinde çalıştığı platformun tüm özelliklerini bilsin. */
  sysPrompt += `\n\n${PLATFORM_KNOWLEDGE}`;
  if (body.projectPrompt) sysPrompt += `\n\n[Proje talimatları]: ${body.projectPrompt}`;
  /* Stil + hafıza + skills + arama bağlamı — istemci ile ortak tek kaynak. */
  sysPrompt += buildContextSections({
    style: body.style,
    memories: body.memories,
    skills: body.skills,
    searchContext: body.searchContext,
  });
  if (body.tools && body.repoCtx) {
    /* SOUL.md — OpenClaw-inspired project context file */
    const soulContent = await fetchSoulFile(body.repoCtx).catch(() => null);
    if (soulContent) {
      sysPrompt += `\n\n[Proje bağlamı — SOUL.md]:\n${soulContent.slice(0, 6000)}`;
    }
    /* Proje profili: framework algılama (package.json) + .gitignore farkındalığı.
       Tek seferlik, paralel çekim; hata olursa sessiz geçilir. */
    const [pkgRaw, gitignoreRaw] = await Promise.all([
      getFileRaw(body.repoCtx, "package.json").then((r) => (r.ok ? r.content : null)).catch(() => null),
      getFileRaw(body.repoCtx, ".gitignore").then((r) => (r.ok ? r.content : null)).catch(() => null),
    ]);
    const frameworks = pkgRaw ? detectFrameworks({ deps: extractDeps(pkgRaw) }) : [];
    if (frameworks.length || gitignoreRaw) {
      sysPrompt += `\n\n[Proje profili]`;
      if (frameworks.length) sysPrompt += `\n• Algılanan teknolojiler: ${frameworks.join(", ")} — bu ekosistemin en iyi pratiklerini uygula.`;
      if (gitignoreRaw) {
        const ignored = parseGitignore(gitignoreRaw).slice(0, 30).join(", ");
        sysPrompt += `\n• .gitignore kalıpları (bunlara dokunma/oluşturma): ${ignored}`;
      }
    }
    sysPrompt +=
      `\n\n[Ajan modu — Repo: ${body.repoCtx.owner}/${body.repoCtx.repo} (${body.repoCtx.branch})]\n` +
      `Mevcut araçlar:\n` +
      `• list_files(filter?) — repo dosya ağacını listele\n` +
      `• read_file(path) — dosya içeriğini oku (SATIR NUMARALARIYLA döner)\n` +
      `• read_files(paths[]) — birden çok dosyayı TEK çağrıda oku\n` +
      `• glob(pattern) — yıldızlı desenle dosya bul (ör. src/**/*.tsx)\n` +
      `• grep(pattern, glob?, ignore_case?) — regex ile içerik ara (dosya:satır)\n` +
      `• search_files(query) — dosya yolunda arama\n` +
      `• search_code(query, extension?) — dosya İÇERİĞİNDE arama (basit)\n` +
      `• str_replace(path, old_string, new_string, commit_message?) — HEDEFLİ düzenleme (tercih et)\n` +
      `• write_file(path, content, commit_message) — YENİ dosya veya tam değişim\n` +
      `• delete_file(path, reason?) — dosya silmeyi ÖNERİR (kullanıcı onaylar)\n` +
      `• rename_file(path, new_path, reason?) — yeniden adlandırmayı ÖNERİR (kullanıcı onaylar)\n` +
      `• list_branches() / create_branch(name, from?) — dal işlemleri\n` +
      `• create_pr(title, head, base, body?) — PR/MR aç (başlık+açıklamayı sen üret)\n` +
      `• get_commit_history(limit?, path?) — commit geçmişi\n` +
      `• git_diff(base, head) — iki dal/commit arasındaki farkı göster\n` +
      `• git_log(branch?, path?, limit?) — commit geçmişini listele\n` +
      `• git_blame(path, startLine?, endLine?) — dosyayı etkileyen son commit'ler\n` +
      `• discover_rules() — CLAUDE.md/AGENTS.md/.rules gibi davranış dosyalarını otomatik tara\n` +
      `• trigger_ci(workflow, ref?, inputs?) — GitHub Actions workflow'unu tetikle\n` +
      `• dispatch_agents(tasks[]) — karmaşık görevi PARALEL salt-okunur alt-ajanlara böl (Claude'daki gibi)\n` +
      `• update_plan(plan) — çok adımlı görevde canlı yapılacaklar listesi\n` +
      (body.webSearch ? `• web_search(query) — internette ara\n• read_url(url) — web sayfası oku\n` : "") +
      `\nÇalışma pratiği:\n` +
      `— Çok adımlı (3+) görevlerde önce update_plan ile adımları yaz, her adım bitince planı güncelle.\n` +
      `— Görev BAĞIMSIZ paralel parçalara bölünebiliyorsa (ör. birden çok modülü ayrı ayrı incelemek) dispatch_agents ile alt-ajanlara dağıt; basitse kendin yap.\n` +
      `— Cevaplamadan önce ilgili dosyaları oku. Bağımsız okumaları TEK turda birlikte iste (paralel çalışır).\n` +
      `— list_files veya search_code ile önce yapıyı anla, sonra spesifik dosyalara gir.\n` +
      `— Var olan dosyada KÜÇÜK değişiklik için str_replace kullan (tüm dosyayı yeniden yazma); old_string ham metin olmalı (satır numarası DEĞİL), birebir ve benzersiz.\n` +
      `— Yalnızca yeni dosya veya köklü değişimde write_file kullan. Kullanıcının onayına gerek yok.\n` +
      `— Silme/yeniden adlandırma YIKICIDIR: delete_file/rename_file yalnızca ÖNERİR, kullanıcı onaylayana kadar gerçekleşmez; buna güvenip 'sildim' deme.\n` +
      `— Aynı dosyayı tekrar okuma; okuduklarını hatırla.\n` +
      `— Karmaşık görevde adım adım ilerle: keşfet → analiz et → değiştir → doğrula.`;
    if (body.safeMode) {
      sysPrompt +=
        `\n\n[ÖNEMLİ — Salt-okunur (Güvenli Mod) açık]\n` +
        `Bu oturumda HİÇBİR değiştirici işlem yapamazsın: dosya yazma/düzenleme, ` +
        `silme, yeniden adlandırma, dal/PR oluşturma ve komut çalıştırma araçları DEVRE DIŞI. ` +
        `Yalnızca okuma, arama ve analiz yap. Bir değişiklik gerekiyorsa onu \`\`\`dil:dosya/yolu ` +
        `kod bloğu olarak ÖNER; kullanıcı Güvenli Mod'u kapatıp kendisi uygular.`;
    } else if (body.requireWriteApproval) {
      sysPrompt +=
        `\n\n[ÖNEMLİ — Onay modu açık]\n` +
        `Dosyaları DOĞRUDAN YAZMA/commit ETME (write_file/str_replace KULLANMA). ` +
        `Bunun yerine değişiklikleri \`\`\`dil:dosya/yolu biçiminde kod bloğu olarak ÖNER; ` +
        `kullanıcı inceleyip commit arayüzüyle kendisi uygular. Okuma/arama araçlarını serbestçe kullan.`;
    }
    if (body.planApprovalMode && !body.planApproved) {
      sysPrompt +=
        `\n\n[ÖNEMLİ — Plan modu açık]\n` +
        `ÖNCE ilgili dosyaları okuyup anla, sonra update_plan ile NET ve ayrıntılı bir uygulama planı sun ve DUR. ` +
        `Hiçbir değişiklik YAPMA (yazma/silme araçları zaten devre dışı). Planı + kısa gerekçeyi yaz, ` +
        `kullanıcı planı onaylayıp 'uygula' dediğinde bir sonraki turda gerçekleştireceksin.`;
    }
  }
  if (body.webSearch && !body.repoCtx) {
    sysPrompt +=
      `\n\n[Web arama modu]\n` +
      `Mevcut araçlar: web_search(query), read_url(url)\n` +
      `Bilgi gerektiren sorularda önce web_search ile ara, sonra ilgili sayfaları read_url ile oku.`;
  }

  /* Tool-use disabled: simple passthrough */
  if (!body.tools && !body.webSearch) {
    const messages = [{ role: "system", content: sysPrompt }, ...body.messages];
    let upstream: Response;
    /* Pollinations token'ı klasik olarak `?token=` query param ile doğrulanır;
       yalnızca Bearer header çoğu durumda yok sayılıp istek anonim sayılır →
       rate-limit/hata. Token varsa query param olarak da geçir. */
    const url = provider === "pollinations" && apiKey
      ? `${baseUrl}/chat/completions?token=${encodeURIComponent(apiKey)}`
      : `${baseUrl}/chat/completions`;
    /* Pollinations için referrer ekle (anonim isteklerin agresif kısıtlanmasını azaltır). */
    const upstreamBody: Record<string, unknown> = { model, messages, stream: true, ...sampling };
    if (provider === "pollinations") upstreamBody.referrer = "craft-coder";

    try {
      upstream = await fetch(url, {
        method: "POST", headers: upstreamHeaders,
        body: JSON.stringify(upstreamBody),
      });
    } catch (err) {
      return new Response(`Sağlayıcıya bağlanılamadı: ${(err as Error).message}`, { status: 502 });
    }
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return new Response(friendlyApiError(upstream.status, detail, { model, provider: body.provider }), { status: upstream.status || 500 });
    }
    return new Response(upstream.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
    });
  }

  /* Tool-use loop */
  const repoCtx = body.repoCtx;
  const activeMcpServers = (body.mcpServers ?? []).filter((s) => s.enabled !== false);
  const convo: ChatRequest["messages"] = [
    { role: "system", content: sysPrompt },
    ...body.messages,
  ];

  /* Fetch MCP tools in parallel */
  const mcpToolDefs = (await Promise.all(
    activeMcpServers.map((srv) => fetchMcpTools(srv)),
  )).flat();
  const WEB_TOOLS = [
    {
      type: "function" as const,
      function: {
        name: "web_search",
        description: "Web'de arama yapar. Güncel bilgi, haber, dökümantasyon veya herhangi bir konu hakkında internette arama yap.",
        parameters: {
          type: "object" as const,
          properties: { query: { type: "string", description: "Arama sorgusu" } },
          required: ["query"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "read_url",
        description: "Bir web sayfasını okur ve içeriğini döndürür. web_search sonucundaki linkleri okumak için kullan.",
        parameters: {
          type: "object" as const,
          properties: { url: { type: "string", description: "Okunacak URL (tam adres)" } },
          required: ["url"],
        },
      },
    },
  ];
  /* İzin/plan moduna göre araçları kısıtla:
     - Onay modu veya plan-modu(onaylanmadan): yazma araçları kaldırılır.
     - Plan modu (onaylanmadan): yıkıcı öneriler de kaldırılır → ajan yalnızca planlar. */
  const planGate = !!body.planApprovalMode && !body.planApproved;
  const blockWrites = !!body.requireWriteApproval || planGate;
  let coderTools = [...CODER_TOOLS, ...EXTENSION_TOOLS];
  if (blockWrites) coderTools = coderTools.filter((t) => t.function.name !== "write_file" && t.function.name !== "str_replace");
  if (planGate) coderTools = coderTools.filter((t) => t.function.name !== "delete_file" && t.function.name !== "rename_file");
  /* Salt-okunur Güvenli Mod: TÜM değiştirici araçları kaldır (yazma/silme/
     yeniden adlandırma/dal/PR/komut). Yalnızca okuma+arama kalır. */
  if (body.safeMode) {
    const MUTATING_TOOLS = new Set(["write_file", "str_replace", "delete_file", "rename_file", "create_branch", "create_pr", "run_command"]);
    coderTools = coderTools.filter((t) => !MUTATING_TOOLS.has(t.function.name));
  }
  /* run_command yalnızca istemcide terminal varsa sunulur (yoksa çıktı gelmez). */
  if (!body.terminalAvailable) coderTools = coderTools.filter((t) => t.function.name !== "run_command");
  let allTools = [
    ...(body.tools && body.repoCtx ? coderTools : []),
    ...(body.webSearch && !body.blockNetworkTools ? WEB_TOOLS : []),
    ...mcpToolDefs.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  ];
  /* Granüler izin: kullanıcının açıkça reddettiği (toolPermissions[name] === false)
     araçlar ajana hiç sunulmaz. Anahtar yoksa veya true ise izinli. */
  if (body.toolPermissions) {
    const perms = body.toolPermissions;
    allTools = allTools.filter((t) => perms[t.function.name] !== false);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const MAX_ROUNDS = 25;
      /* Pollinations token'ı klasik olarak `?token=` query param ile doğrulanır;
       yalnızca Bearer header çoğu durumda yok sayılıp istek anonim sayılır →
       rate-limit/hata. Token varsa query param olarak da geçir. */
    const url = provider === "pollinations" && apiKey
      ? `${baseUrl}/chat/completions?token=${encodeURIComponent(apiKey)}`
      : `${baseUrl}/chat/completions`;
      /* İstek başına dosya-okuma önbelleği: aynı dosya tekrar çekilmez. */
      const readCache = new Map<string, string>();
      /* Gerçek token kullanımı: OpenAI-uyumlu sağlayıcılar son chunk'ta usage
         döndürebilir (stream_options.include_usage). Tüm turlar boyunca topla. */
      const supportsUsageStream = !["pollinations", "ollama"].includes(provider);
      const realUsage = { prompt: 0, completion: 0 };
      for (let round = 0; round < MAX_ROUNDS; round++) {
        let upstream: Response;

        try {
          upstream = await fetch(url, {
            method: "POST", headers: upstreamHeaders,
            body: JSON.stringify({
              model,
              /* Bağlam yönetimi: eski/büyük tool çıktılarını kırp (yapı korunur). */
              messages: pruneMessages(convo, { keepRecent: 16, maxContentChars: 12000 }),
              stream: true,
              tools: allTools,
              tool_choice: round === MAX_ROUNDS - 1 ? "none" : "auto",
              ...(supportsUsageStream ? { stream_options: { include_usage: true } } : {}),
              ...sampling,
            }),
          });
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**Bağlantı hatası:** ${(err as Error).message}` } }] })}\n\n`));
          break;
        }
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**${friendlyApiError(upstream.status, detail, { model, provider: body.provider })}**` } }] })}\n\n`));
          break;
        }

        const { content, toolCalls, finishReason, usage } = await streamRound(upstream, controller, encoder);
        if (usage) {
          /* prompt = en güncel turun bağlam boyutu; completion = turların toplamı. */
          realUsage.prompt = usage.prompt || realUsage.prompt;
          realUsage.completion += usage.completion;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage_event: { prompt: realUsage.prompt, completion: realUsage.completion } })}\n\n`));
        }

        if (toolCalls.length === 0 || finishReason === "stop") {
          /* Bitiş nedenini istemciye ilet: "length" ⇒ yanıt token sınırında
             kesildi → istemci kesilme şeridi gösterir / otomatik devam eder. */
          if (finishReason && finishReason !== "tool_calls") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ finish_event: { reason: finishReason } })}\n\n`));
          }
          break;
        }

        /* Append assistant turn with tool calls */
        convo.push({
          role: "assistant",
          content: content || "",
          tool_calls: toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        });

        /* Araç çağrılarını yürüt: OKUMALAR paralel (hız), YAZMALAR sıralı
           (aynı dosyaya eşzamanlı yazıp veri kaybını önlemek için). start
           olayları önce; tool mesajları orijinal sırada (tool_call_id eşleşir). */
        for (const tc of toolCalls) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "start", id: tc.id, name: tc.name, arguments: tc.arguments } })}\n\n`),
          );
        }
        const MUTATING = new Set(["write_file", "str_replace"]);
        const resultById = new Map<string, string>();
        /* Tur başına tek-commit buffer: tüm write_file/str_replace bu Map'e eklenir,
           tur sonunda tek bir atomik commit olarak kaydedilir. */
        const roundWrites = new Map<string, WriteEntry>();

        const runOne = async (tc: AccumulatedToolCall) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.arguments || "{}"); } catch { /* invalid */ }
          /* dispatch_agents: ana ajan görevi paralel SALT-OKUNUR alt-ajanlara
             böler (Claude'daki Task aracı gibi). Sonuçlar birleştirilip döner. */
          if (tc.name === "dispatch_agents") {
            const tasks = Array.isArray(args.tasks)
              ? (args.tasks as { title?: string; instruction?: string }[])
                  .filter((t) => t && typeof t.instruction === "string" && t.instruction.trim())
                  .slice(0, 4)
              : [];
            const fail = (m: string) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: m } })}\n\n`));
              resultById.set(tc.id, m);
            };
            if (!repoCtx) { fail("Hata: repo bağlı değil"); return; }
            if (tasks.length === 0) { fail("Hata: en az 1 alt görev (tasks) gerekli"); return; }
            const subCfg = { baseUrl, model, provider: (body.provider || "hf") as Provider, headers: upstreamHeaders };
            const results = await Promise.all(tasks.map(async (t) => {
              try {
                return await runReadOnlyAgent(subCfg, [
                  { role: "system", content: "Sen uzman bir alt-ajansın. SADECE verilen alt göreve odaklan; repoyu read_file/list_files ile incele ve NET, uygulanabilir bir özet/sonuç döndür. Türkçe yaz." },
                  { role: "user", content: `ALT GÖREV: ${t.title || ""}\n${t.instruction}` },
                ], repoCtx);
              } catch (e) { return `(hata: ${(e as Error).message})`; }
            }));
            const combined = tasks.map((t, i) => `### ${t.title || "Alt görev"}\n${results[i]}`).join("\n\n");
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: `${tasks.length} alt-ajan tamamlandı` } })}\n\n`));
            resultById.set(tc.id, combined);
            return;
          }
          /* Yıkıcı işlemler (silme/yeniden adlandırma): ASLA doğrudan yapılmaz.
             Kullanıcı onayına sunulur; istemci onaylarsa uygular. */
          if (tc.name === "delete_file" || tc.name === "rename_file") {
            const path = String(args.path ?? "");
            const newPath = tc.name === "rename_file" ? String(args.new_path ?? "") : undefined;
            const reason = args.reason ? String(args.reason) : undefined;
            if (!path || (tc.name === "rename_file" && !newPath)) {
              const msg = "Hata: gerekli yol(lar) eksik";
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: msg } })}\n\n`));
              resultById.set(tc.id, msg);
              return;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ pending_action_event: { id: tc.id, kind: tc.name === "delete_file" ? "delete" : "rename", path, newPath, reason } })}\n\n`));
            const note = tc.name === "delete_file"
              ? `⏸ '${path}' silme önerisi kullanıcı onayına sunuldu. Kullanıcı onaylayana kadar dosya DURUYOR; buna güvenerek devam etme.`
              : `⏸ '${path}' → '${newPath}' yeniden adlandırma önerisi kullanıcı onayına sunuldu.`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`));
            resultById.set(tc.id, note);
            return;
          }
          /* run_command: sunucuda terminal yok → komutu istemciye olay olarak yolla.
             İstemci terminalde çalıştırır, çıktıyı yeni bir mesaj olarak geri gönderir
             (craftai:terminal-output → callApi). Bu turda placeholder sonuç döner. */
          if (tc.name === "run_command") {
            const command = String(args.command ?? "").trim();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ run_command_event: { command } })}\n\n`));
            const note = `⏳ '${command}' komutu terminale gönderildi. Çıktısı ayrı bir mesaj olarak gelecek; ona göre devam et.`;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`),
            );
            resultById.set(tc.id, note);
            return;
          }
          /* update_plan: ağ/repo işi yok — planı istemciye ayrı olay olarak yolla. */
          if (tc.name === "update_plan") {
            const plan = String(args.plan ?? "");
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ plan_event: { plan } })}\n\n`));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: "Plan güncellendi" } })}\n\n`),
            );
            resultById.set(tc.id, "Plan güncellendi.");
            return;
          }
          /* Checkpoint: yazma öncesi eski içeriği yakala (geri al için).
             getFileRaw readCache'i ısıtır → str_replace tekrar çekmez.
             Dosya yoksa ve write_file ile OLUŞTURULUYORSA previous: null
             gönderilir → istemcide geri al = dosyayı sil. */
          let prevContent: string | null | undefined;
          if ((tc.name === "write_file" || tc.name === "str_replace") && repoCtx && typeof args.path === "string") {
            const old = await getFileRaw(repoCtx, args.path, readCache);
            if (old.ok) prevContent = old.content;
            else if (tc.name === "write_file") prevContent = null;
          }
          /* Yazma araçları → toplu commit buffer'ına ekle; diğerleri anında çalış. */
          const result = await executeTool(
            tc.name, args, repoCtx, activeMcpServers, readCache,
            MUTATING.has(tc.name) ? roundWrites : undefined,
          );
          if (prevContent !== undefined && result.startsWith("✅") && typeof args.path === "string") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ checkpoint_event: { path: args.path, previous: prevContent } })}\n\n`),
            );
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: result.slice(0, 400) + (result.length > 400 ? "…" : "") } })}\n\n`),
          );
          resultById.set(tc.id, result);
        };
        await Promise.all(toolCalls.filter((tc) => !MUTATING.has(tc.name)).map(runOne));
        for (const tc of toolCalls.filter((tc) => MUTATING.has(tc.name))) await runOne(tc);

        /* Toplu commit: turun tüm yazımlarını tek Git commit olarak kaydet. */
        if (roundWrites.size > 0 && repoCtx) {
          /* Commit mesajını tool argümanlarından topla; yoksa otomatik üret. */
          const commitMsg = toolCalls
            .filter((tc) => MUTATING.has(tc.name))
            .map((tc) => { try { return (JSON.parse(tc.arguments || "{}") as { commit_message?: string }).commit_message; } catch { return ""; } })
            .find((m) => m && m.trim())
            || (() => {
              const paths = [...roundWrites.keys()];
              return paths.length === 1
                ? `chore: update ${paths[0]}`
                : `chore: update ${paths.length} files (${paths.map((p) => p.split("/").pop()).join(", ")})`;
            })();
          const batchResult = await flushAtomicCommit(repoCtx, roundWrites, commitMsg);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ batch_commit_event: { count: roundWrites.size, result: batchResult } })}\n\n`));
          /* Tool sonuçlarını gerçek commit bilgisiyle güncelle (AI sonraki turda görsün). */
          if (batchResult.startsWith("✅")) {
            for (const tc of toolCalls.filter((tc) => MUTATING.has(tc.name))) {
              const prev = resultById.get(tc.id) ?? "";
              if (prev.startsWith("✅")) {
                resultById.set(tc.id, prev.replace(" (toplu commit bekleniyor)", "") + ` → ${batchResult}`);
              }
            }
          }
        }
        for (const tc of toolCalls) {
          convo.push({ role: "tool", tool_call_id: tc.id, content: resultById.get(tc.id) ?? "" });
        }
      }
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
