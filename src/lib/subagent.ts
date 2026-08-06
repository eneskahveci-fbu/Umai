import { READONLY_TOOLS, WRITE_TOOLS, executeReadTool, type RepoReadCtx } from "./repoRead";
import { anthropicUpstream, type OpenAIChatBody } from "./anthropic";
import type { Provider } from "./types";

/* Paylaşılan alt-ajan çalıştırıcı: bir modeli SALT-OKUNUR repo araçlarıyla,
   bounded bir tool-use döngüsünde çalıştırır. Hem orkestrasyon işçileri hem
   ana ajanın dispatch_agents aracı kullanır. */

export interface SubAgentCfg {
  baseUrl: string;
  model: string;
  provider: Provider;
  headers: Record<string, string>;
  /** anthropicUpstream'i çağırabilmek için (yalnız provider==="anthropic"
      iken kullanılır) — J1: önceden HİÇ yoktu, alt-ajanlar Claude'da
      `${baseUrl}/chat/completions`'a (Anthropic'te böyle bir uç YOK) OpenAI
      şekilli bir gövdeyle istek atıp başarısız oluyordu. */
  apiKey?: string;
}

const MAX_TOOL_ROUNDS = 4;

interface AccToolCall { id: string; name: string; arguments: string }

/* OpenAI-uyumlu SSE akışını (anthropicUpstream'in translateStream'i de AYNI
   şekli üretir) tek bir asistan turuna biriktirir — sohbet route'undaki tool-
   call delta birikimiyle AYNI mantık, burada sub-agent'ın non-streaming
   ihtiyacı için tekrar kullanılıyor. */
async function accumulateSSE(res: Response): Promise<{ content: string; toolCalls: AccToolCall[] }> {
  if (!res.body) return { content: "", toolCalls: [] };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const calls: { id?: string; name?: string; args: string }[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
        };
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        for (const tc of delta?.tool_calls ?? []) {
          const idx = tc.index;
          if (!calls[idx]) calls[idx] = { args: "" };
          if (tc.id) calls[idx].id = tc.id;
          if (tc.function?.name) calls[idx].name = tc.function.name;
          if (tc.function?.arguments) calls[idx].args += tc.function.arguments;
        }
      } catch { /* parçalı satır */ }
    }
  }
  return {
    content: content.trim(),
    toolCalls: calls.filter(Boolean).map((c, i) => ({ id: c.id || `call_${i}`, name: c.name || "", arguments: c.args })),
  };
}

/* Bir tur model çağrısı — Anthropic'te NATIVE uca (anthropicUpstream), diğer
   sağlayıcılarda OpenAI-uyumlu `/chat/completions`'a gider. İkisi de SSE
   döner (anthropicUpstream'in çevirdiği ya da doğal OpenAI akışı), tek bir
   accumulateSSE ile aynı şekilde toplanır. */
async function callTurn(
  cfg: SubAgentCfg,
  messages: { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }[],
  toolChoice: "auto" | "none",
  signal?: AbortSignal,
  withTools = true,
  tools: unknown[] = READONLY_TOOLS,
): Promise<{ content: string; toolCalls: AccToolCall[] }> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    stream: true,
    /* Depo bağlı değilken araç HİÇ gönderilmez: salt-okunur araçların hepsi
       repoya bağlıdır, boş bir `tools` dizisi bazı sağlayıcılarda 400 verir. */
    ...(withTools ? { tools, tool_choice: toolChoice } : {}),
  };
  if (cfg.provider === "pollinations") body.referrer = "craft-coder";
  if (cfg.provider === "anthropic") {
    const res = await anthropicUpstream(cfg.baseUrl, cfg.apiKey ?? "", body as unknown as OpenAIChatBody, signal);
    if (!res.ok) throw new Error(`Model hatası ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return accumulateSSE(res);
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok) throw new Error(`Model hatası ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return accumulateSSE(res);
}

export async function runReadOnlyAgent(
  cfg: SubAgentCfg,
  messages: { role: string; content: string }[],
  /* `null` = depo bağlı DEĞİL. Alt-ajan bu durumda salt-okunur repo araçları
     olmadan, tek turda kendi bilgisiyle yanıtlar — /api/orchestrate'in
     işçileri için zaten geçerli olan davranışın (repoCtx ? … : callModel)
     buraya taşınmış hâli. Böylece "Ajan Ekibi" depo gerektirmeden çalışır. */
  ctx: RepoReadCtx | null,
  signal?: AbortSignal,
  /** true ise alt-ajan write_file/str_replace de kullanabilir (Claude'un
      alt-ajanlarının gerçek iş yapabilmesi gibi). Çağıran taraf bunu YALNIZ
      yazma kapıları açıkken vermeli (Güvenli Mod / Plan modu kapalıysa);
      ayrıca gerçek dosya sistemi şartı burada ve executeReadTool içinde
      İKİ KEZ doğrulanır — API yolunda paralel commit yarışı olurdu. */
  allowWrite = false,
): Promise<string> {
  type Msg = { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string };
  const convo: Msg[] = [...messages];
  if (!ctx) return (await callTurn(cfg, convo, "none", signal, false)).content;
  const canWrite = allowWrite && ctx.provider === "local";
  const tools = canWrite ? [...READONLY_TOOLS, ...WRITE_TOOLS] : READONLY_TOOLS;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS - 1;
    const { content, toolCalls } = await callTurn(cfg, convo, lastRound ? "none" : "auto", signal, true, tools);
    if (toolCalls.length === 0) return content;
    convo.push({ role: "assistant", content, tool_calls: toolCalls.map((tc) => ({ id: tc.id, function: { name: tc.name, arguments: tc.arguments } })) });
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.arguments || "{}"); } catch { /* ignore */ }
      const result = await executeReadTool(tc.name, args, ctx, canWrite);
      convo.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  return "(Alt-ajan tur sınırına ulaştı.)";
}
