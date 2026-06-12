import { READONLY_TOOLS, executeReadTool, type RepoReadCtx } from "./repoRead";
import type { Provider } from "./types";

/* Paylaşılan alt-ajan çalıştırıcı: bir modeli SALT-OKUNUR repo araçlarıyla,
   bounded bir tool-use döngüsünde çalıştırır. Hem orkestrasyon işçileri hem
   ana ajanın dispatch_agents aracı kullanır. */

export interface SubAgentCfg {
  baseUrl: string;
  model: string;
  provider: Provider;
  headers: Record<string, string>;
}

const MAX_TOOL_ROUNDS = 4;

export async function runReadOnlyAgent(
  cfg: SubAgentCfg,
  messages: { role: string; content: string }[],
  ctx: RepoReadCtx,
  signal?: AbortSignal,
): Promise<string> {
  type Msg = { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string };
  const convo: Msg[] = [...messages];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: convo,
      stream: false,
      tools: READONLY_TOOLS,
      tool_choice: round === MAX_TOOL_ROUNDS - 1 ? "none" : "auto",
    };
    if (cfg.provider === "pollinations") body.referrer = "craft-coder";
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
    });
    if (!res.ok) throw new Error(`Model hatası ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json() as {
      choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    };
    const msg = data.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];
    if (toolCalls.length === 0) return msg?.content?.trim() ?? "";
    convo.push({ role: "assistant", content: msg?.content ?? "", tool_calls: toolCalls });
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
      const result = await executeReadTool(tc.function.name, args, ctx);
      convo.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  return "(Alt-ajan tur sınırına ulaştı.)";
}
