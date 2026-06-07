import { DEFAULT_SYSTEM_PROMPT, STYLE_LABELS } from "@/lib/constants";
import { PLATFORM_KNOWLEDGE } from "@/lib/platform-knowledge";
import { CODER_TOOLS } from "@/lib/tools";
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
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillPayload[];
  searchContext?: string;
  projectPrompt?: string;
  tools?: boolean;
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

async function execListFiles(ctx: RepoCtx, args: { filter?: string }): Promise<string> {
  const filter = args.filter?.toLowerCase();
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} ${await res.text()}`;
    const data = await res.json();
    const items = (data as { path: string; type: string }[])
      .filter((t) => t.type === "blob")
      .map((t) => t.path)
      .filter((p) => !filter || p.toLowerCase().includes(filter));
    return items.slice(0, 200).join("\n") || "(eşleşen dosya yok)";
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status} ${await res.text()}`;
  const data = await res.json();
  const items = (data.tree as { path: string; type: string }[])
    .filter((t) => t.type === "blob")
    .map((t) => t.path)
    .filter((p) => !filter || p.toLowerCase().includes(filter));
  if (items.length > 200) {
    return items.slice(0, 200).join("\n") + `\n\n[${items.length - 200} dosya daha gizlendi — filtre kullan]`;
  }
  return items.join("\n") || "(eşleşen dosya yok)";
}

async function execReadFile(ctx: RepoCtx, args: { path: string }): Promise<string> {
  if (!args.path) return "Hata: path boş";
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const encoded = encodeURIComponent(args.path);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${args.path})`;
    const text = await res.text();
    return text.length > 20_000 ? text.slice(0, 20_000) + "\n\n[... kısaltıldı]" : text;
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(args.path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${args.path})`;
  const data = await res.json();
  if (data.size > 100_000) return `Hata: dosya çok büyük (${data.size} bayt). 100KB üstü desteklenmiyor.`;
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return content.length > 20_000 ? content.slice(0, 20_000) + "\n\n[... kısaltıldı]" : content;
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

async function execWriteFile(ctx: RepoCtx, args: { path: string; content: string; commit_message: string }): Promise<string> {
  if (!args.path || !args.content) return "Hata: path ve content zorunlu";
  const msg = args.commit_message || `chore: update ${args.path}`;
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
): Promise<string> {
  try {
    if (!ctx && ["list_files","read_file","search_files","search_code","write_file","list_branches","create_branch","get_commit_history"].includes(name))
      return "Hata: repo bağlı değil. Kullanıcıya bir repo bağlamasını söyle.";
    if (name === "list_files") return await execListFiles(ctx!, args as { filter?: string });
    if (name === "read_file") return await execReadFile(ctx!, args as { path: string });
    if (name === "search_files") return await execSearchFiles(ctx!, args as { query: string });
    if (name === "search_code") return await execSearchCode(ctx!, args as { query: string; extension?: string });
    if (name === "write_file") return await execWriteFile(ctx!, args as { path: string; content: string; commit_message: string });
    if (name === "list_branches") return await execListBranches(ctx!);
    if (name === "create_branch") return await execCreateBranch(ctx!, args as { name: string; from?: string });
    if (name === "get_commit_history") return await execGetCommitHistory(ctx!, args as { limit?: string; path?: string });
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
      } catch {
        /* parçalı satır */
      }
    }
  }
  return { content, toolCalls, finishReason };
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

  /* Anahtar gerektirmeyen ücretsiz/yerel sağlayıcılar. Bunlar için "API anahtarı
     yok" hatası verme ve boş Authorization header'ı gönderme. */
  const keyless = provider === "pollinations" || provider === "ollama" || provider === "custom";

  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  if (!apiKey && !keyless) return new Response("API anahtarı yok.", { status: 400 });

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(provider === "anthropic"
      ? { "anthropic-version": "2023-06-01", "x-api-key": apiKey }
      : { Authorization: `Bearer ${apiKey}` }),
  };
  if (apiKey) upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;

  if (provider === "openrouter") {
    upstreamHeaders["HTTP-Referer"] = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app";
    upstreamHeaders["X-Title"] = "craft.ai";
  }

  let sysPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  /* Eklenen her model, içinde çalıştığı platformun tüm özelliklerini bilsin. */
  sysPrompt += `\n\n${PLATFORM_KNOWLEDGE}`;
  if (body.projectPrompt) sysPrompt += `\n\n[Proje talimatları]: ${body.projectPrompt}`;
  const styleKey = body.style || "normal";
  const stylePrompt = STYLE_LABELS[styleKey]?.prompt;
  if (stylePrompt) sysPrompt += `\n\n[Stil]: ${stylePrompt}`;
  if (body.memories?.length) {
    sysPrompt += `\n\n[Kullanıcı hakkında bildiklerin]:\n${body.memories.map((m) => `- ${m.content}`).join("\n")}`;
  }
  if (body.skills?.length) {
    const fileSkills = body.skills.filter((s) => s.source === "file");
    const manualSkills = body.skills.filter((s) => s.source !== "file");
    if (manualSkills.length) {
      sysPrompt +=
        `\n\n[Eğitim seti — bu kurallara her zaman uy]:\n` +
        manualSkills.map((s) => {
          const tags = s.tags?.length ? ` (${s.tags.join(", ")})` : "";
          return `### ${s.title}${tags}\n${s.content}`;
        }).join("\n\n");
    }
    if (fileSkills.length) {
      sysPrompt +=
        `\n\n[Referans dosyalar — örnek olarak kullan]:\n` +
        fileSkills.map((s) => `--- ${s.fileName || s.title} ---\n${s.content}`).join("\n\n");
    }
  }
  if (body.searchContext) {
    sysPrompt += `\n\n[Web arama sonuçları]:\n${body.searchContext}`;
  }
  if (body.tools && body.repoCtx) {
    /* SOUL.md — OpenClaw-inspired project context file */
    const soulContent = await fetchSoulFile(body.repoCtx).catch(() => null);
    if (soulContent) {
      sysPrompt += `\n\n[Proje bağlamı — SOUL.md]:\n${soulContent.slice(0, 6000)}`;
    }
    sysPrompt +=
      `\n\n[Araç kullanımı]: Bağlı repo: ${body.repoCtx.owner}/${body.repoCtx.repo}:${body.repoCtx.branch}. ` +
      `Kullanabileceğin araçlar: list_files, read_file, search_files, search_code (içerik arar), ` +
      `write_file (dosya yaz/güncelle + commit), list_branches, create_branch, get_commit_history. ` +
      `Cevap vermeden önce gerekli dosyaları oku. write_file ile kod değişikliği yapabilirsin — kullanıcı onay vermişse kullan. ` +
      `Aynı dosyayı tekrar okuma. En kritik 1-3 dosyayı oku.`;
  }

  /* Tool-use disabled: simple passthrough */
  if (!body.tools || !body.repoCtx) {
    const messages = [{ role: "system", content: sysPrompt }, ...body.messages];
    let upstream: Response;
    const url = `${baseUrl}/chat/completions`;

    try {
      upstream = await fetch(url, {
        method: "POST", headers: upstreamHeaders,
        body: JSON.stringify({ model, messages, stream: true }),
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
  const allTools = [
    ...CODER_TOOLS,
    ...mcpToolDefs.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const MAX_ROUNDS = 6;
      const url = `${baseUrl}/chat/completions`;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        let upstream: Response;

        try {
          upstream = await fetch(url, {
            method: "POST", headers: upstreamHeaders,
            body: JSON.stringify({
              model,
              messages: convo,
              stream: true,
              tools: allTools,
              tool_choice: round === MAX_ROUNDS - 1 ? "none" : "auto",
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

        const { content, toolCalls, finishReason } = await streamRound(upstream, controller, encoder);

        if (toolCalls.length === 0 || finishReason === "stop") break;

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

        /* Execute and send results */
        for (const tc of toolCalls) {
          /* notify client of tool call */
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "start", id: tc.id, name: tc.name, arguments: tc.arguments } })}\n\n`),
          );
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.arguments || "{}"); } catch { /* invalid */ }
          const result = await executeTool(tc.name, args, repoCtx, activeMcpServers);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: result.slice(0, 400) + (result.length > 400 ? "…" : "") } })}\n\n`),
          );
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
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
