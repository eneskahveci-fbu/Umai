import type { NextRequest } from "next/server";
import { checkLimit } from "@/lib/rate-limit";
import { isSafeRemoteUrl, safeFetch } from "@/lib/urlSafety";
import { isBuiltinMcpServerId } from "@/lib/mcpBuiltins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface McpServerConfig {
  url: string;
  headers?: Record<string, string>;
}

/* CSRF: yalnızca aynı origin'den gelen isteklere izin ver. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // tarayıcı-dışı/sunucu içi çağrı
  const host = req.headers.get("host");
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* Güvenilir (builtin/own-origin) sunucularda ham fetch; DIŞ sunucularda safeFetch
   → her yönlendirme hop'u isSafeRemoteUrl'den yeniden geçer, aksi halde public bir
   MCP URL'i 302 ile iç ağa/metadata'ya (169.254.169.254) sıçrayıp yanıtı çağırana
   döndürebilirdi (read SSRF). Builtin'ler own-origin'e mutlaklaştığından (localhost
   dev'de safeFetch onları yanlışlıkla engellerdi) ham fetch kullanır. */
async function fetchMcpTools(server: McpServerConfig, trusted: boolean): Promise<{ name: string; description: string; inputSchema: object }[]> {
  const doFetch = trusted ? fetch : (u: string, i?: RequestInit) => safeFetch(u, i);
  const res = await doFetch(`${server.url}/tools/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data = await res.json() as { result?: { tools?: { name: string; description: string; inputSchema: object }[] } };
  return data?.result?.tools ?? [];
}

async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  trusted: boolean,
): Promise<string> {
  const doFetch = trusted ? fetch : (u: string, i?: RequestInit) => safeFetch(u, i);
  const res = await doFetch(`${server.url}/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: args } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return `Error: ${res.status}`;
  const data = await res.json() as { result?: { content?: { type: string; text?: string }[] } };
  const parts = data?.result?.content ?? [];
  return parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n") || "No result";
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return Response.json({ error: "Geçersiz origin" }, { status: 403 });
  const limited = checkLimit(req, "mcp", 60, 60_000);
  if (limited) return Response.json(limited.body, { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const body = await req.json() as { action: "list" | "call"; server: McpServerConfig; tool?: string; args?: Record<string, unknown> };
    const rawUrl = body.server?.url ?? "";
    /* Yerleşik (self-hosted) sunucular göreli bir yol (/api/mcp/builtin/*)
       taşır — bu isteğin kendi origin'iyle mutlaklaştırılır ve SSRF
       kontrolünden muaf tutulur (dış host'a asla erişemez, bkz. mcpBuiltins.ts). */
    const isBuiltin = rawUrl.startsWith("/api/mcp/builtin/") && isBuiltinMcpServerId(rawUrl.slice("/api/mcp/builtin/".length));
    const url = isBuiltin ? new URL(rawUrl, req.url).toString() : rawUrl;
    /* SSRF: MCP sunucu URL'i iç ağa/loopback'e işaret edemez. */
    if (!rawUrl || (!isBuiltin && !isSafeRemoteUrl(url))) {
      return Response.json({ error: "Geçersiz veya güvenli olmayan MCP sunucu adresi." }, { status: 400 });
    }
    const server = { ...body.server, url };
    if (body.action === "list") {
      const tools = await fetchMcpTools(server, isBuiltin);
      return Response.json({ tools });
    }
    if (body.action === "call" && body.tool) {
      const result = await callMcpTool(server, body.tool, body.args ?? {}, isBuiltin);
      return Response.json({ result });
    }
    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
