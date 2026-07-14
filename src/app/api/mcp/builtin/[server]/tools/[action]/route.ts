import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isBuiltinMcpServerId, listBuiltinTools, callBuiltinTool } from "@/lib/mcpBuiltins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Yerleşik MCP sunucuları — /api/mcp/route.ts VE api/chat/route.ts'in
   tool-execution döngüsüyle AYNI bespoke JSON-RPC şeklini (tools/list,
   tools/call) konuşur (gerçek MCP Streamable HTTP spec'i değil — bu
   uygulamanın kendi basit sözleşmesi). Mantık src/lib/mcpBuiltins.ts'te
   (saf, test edilebilir); burada yalnız HTTP'ye bağlanır. */

interface RpcBody {
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ server: string; action: string }> },
) {
  const limited = rateLimit(req, "mcp-builtin", 120, 60_000);
  if (limited) return limited;

  const { server, action } = await params;
  if (!isBuiltinMcpServerId(server)) {
    return Response.json({ error: "Bilinmeyen yerleşik sunucu." }, { status: 404 });
  }

  let body: RpcBody = {};
  try { body = await req.json(); } catch { /* boş gövde — list için sorun değil */ }

  if (action === "list") {
    return Response.json({ result: { tools: listBuiltinTools(server) } });
  }
  if (action === "call") {
    const toolName = body.params?.name ?? "";
    const args = body.params?.arguments ?? {};
    const text = callBuiltinTool(server, toolName, args);
    return Response.json({ result: { content: [{ type: "text", text }] } });
  }
  return Response.json({ error: "Geçersiz eylem." }, { status: 400 });
}
