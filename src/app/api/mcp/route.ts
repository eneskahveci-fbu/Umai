export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface McpServerConfig {
  url: string;
  headers?: Record<string, string>;
}

async function fetchMcpTools(server: McpServerConfig): Promise<{ name: string; description: string; inputSchema: object }[]> {
  const res = await fetch(`${server.url}/tools/list`, {
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
): Promise<string> {
  const res = await fetch(`${server.url}/tools/call`, {
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

export async function POST(req: Request) {
  try {
    const body = await req.json() as { action: "list" | "call"; server: McpServerConfig; tool?: string; args?: Record<string, unknown> };
    if (body.action === "list") {
      const tools = await fetchMcpTools(body.server);
      return Response.json({ tools });
    }
    if (body.action === "call" && body.tool) {
      const result = await callMcpTool(body.server, body.tool, body.args ?? {});
      return Response.json({ result });
    }
    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
