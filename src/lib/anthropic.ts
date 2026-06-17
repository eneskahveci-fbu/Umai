/* ════════════════════════════════════════════════════════════════════════
   Anthropic (Claude) NATIVE adaptörü — prompt caching + native thinking/tools.
   OpenAI-stili istek gövdesini Claude'un /v1/messages API'sine çevirir; dönen
   native SSE akışını OpenAI-stili SSE'ye çevirip bir Response döndürür → chat
   route'un geri kalanı (streamRound / basit pipe) HİÇ değişmeden çalışır.

   Kazanç (yalnızca provider === "anthropic" için):
   • prompt caching: system prompt + tools blokları cache_control ile önbelleğe
     alınır → her turda tekrar faturalanmaz (uzun ajan oturumlarında maliyet↓ hız↑).
   • native thinking (thinking_delta) ve native tool_use desteği.
   Diğer sağlayıcılar bu dosyaya hiç uğramaz (OpenAI yolu aynen korunur).
   ════════════════════════════════════════════════════════════════════════ */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface OAIToolCall { id: string; function: { name: string; arguments: string } }
interface OAIMsg { role: string; content: unknown; tool_calls?: OAIToolCall[]; tool_call_id?: string }
interface OAITool { type: string; function: { name: string; description?: string; parameters?: unknown } }
export interface OpenAIChatBody {
  model: string;
  messages: OAIMsg[];
  tools?: OAITool[];
  max_tokens?: number;
  temperature?: number;
}

type Block = Record<string, unknown>;
interface AMsg { role: "user" | "assistant"; content: Block[] }

const EPHEMERAL = { type: "ephemeral" as const };

/* OpenAI mesaj içeriğini (string | multimodal dizi) Anthropic bloklarına çevir. */
function contentToBlocks(content: unknown): Block[] {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  if (Array.isArray(content)) {
    const blocks: Block[] = [];
    for (const part of content as any[]) {
      if (part?.type === "text" && part.text) blocks.push({ type: "text", text: String(part.text) });
      else if (part?.type === "image_url" && part.image_url?.url) {
        const m = /^data:(.+?);base64,(.*)$/.exec(String(part.image_url.url));
        if (m) blocks.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      }
    }
    return blocks;
  }
  return [];
}

/* OpenAI-stili mesaj dizisini Anthropic {system, messages} biçimine çevir.
   - system rolü → üst-seviye system (cache_control ile)
   - tool rolü → user içinde tool_result bloğu
   - assistant tool_calls → assistant içinde tool_use blokları
   - ardışık aynı-rol mesajları birleştirilir (Claude alternasyon ister). */
function convertMessages(messages: OAIMsg[]): { system: Block[]; messages: AMsg[] } {
  const sysParts: string[] = [];
  const out: AMsg[] = [];
  const push = (role: "user" | "assistant", blocks: Block[]) => {
    if (!blocks.length) return;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string" && m.content.trim()) sysParts.push(m.content);
      continue;
    }
    if (m.role === "tool") {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      push("user", [{ type: "tool_result", tool_use_id: m.tool_call_id || "", content: text }]);
      continue;
    }
    if (m.role === "assistant") {
      const blocks = contentToBlocks(m.content);
      for (const tc of m.tool_calls ?? []) {
        let input: unknown = {};
        try { input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { input = {}; }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      push("assistant", blocks);
      continue;
    }
    push("user", contentToBlocks(m.content));
  }
  const sysText = sysParts.join("\n\n");
  const system: Block[] = sysText ? [{ type: "text", text: sysText, cache_control: EPHEMERAL }] : [];
  return { system, messages: out };
}

function convertTools(tools?: OAITool[]): Block[] | undefined {
  if (!tools?.length) return undefined;
  const out: Block[] = tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
  out[out.length - 1].cache_control = EPHEMERAL; // tools bloğunu önbelleğe al
  return out;
}

/* Native Anthropic SSE → OpenAI-stili SSE çevirici. streamRound/basit-pipe bunu
   normal bir OpenAI yanıtı gibi okur. */
function translateStream(src: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = src.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let toolIndex = -1;
  let inputTokens = 0;
  const emit = (ctrl: ReadableStreamDefaultController, obj: unknown) =>
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  return new ReadableStream({
    async start(controller) {
      try {
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
            if (!data) continue;
            let ev: any;
            try { ev = JSON.parse(data); } catch { continue; }
            switch (ev.type) {
              case "message_start":
                inputTokens = ev.message?.usage?.input_tokens ?? 0;
                break;
              case "content_block_start":
                if (ev.content_block?.type === "tool_use") {
                  toolIndex++;
                  emit(controller, { choices: [{ delta: { tool_calls: [{ index: toolIndex, id: ev.content_block.id, type: "function", function: { name: ev.content_block.name, arguments: "" } }] } }] });
                }
                break;
              case "content_block_delta":
                if (ev.delta?.type === "text_delta") emit(controller, { choices: [{ delta: { content: ev.delta.text } }] });
                else if (ev.delta?.type === "thinking_delta") emit(controller, { choices: [{ delta: { reasoning: ev.delta.thinking } }] });
                else if (ev.delta?.type === "input_json_delta") emit(controller, { choices: [{ delta: { tool_calls: [{ index: toolIndex, function: { arguments: ev.delta.partial_json } }] } }] });
                break;
              case "message_delta": {
                /* stop_reason eşlemesi: max_tokens → "length" (yoksa kesilen yanıt
                   "tamamlandı" sanılır; istemci otomatik "devam" tetiklemez). */
                const sr = ev.delta?.stop_reason;
                const fr = sr === "tool_use" ? "tool_calls" : sr === "max_tokens" ? "length" : (sr ? "stop" : null);
                if (fr) emit(controller, { choices: [{ delta: {}, finish_reason: fr }] });
                if (ev.usage) emit(controller, { choices: [], usage: { prompt_tokens: inputTokens, completion_tokens: ev.usage.output_tokens ?? 0 } });
                break;
              }
              case "message_stop":
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                break;
            }
          }
        }
      } catch (e) {
        try { emit(controller, { choices: [{ delta: { content: `\n\n[Claude akış hatası: ${(e as Error).message}]` } }] }); } catch { /* yok say */ }
      } finally {
        try { controller.close(); } catch { /* yok say */ }
      }
    },
  });
}

/* Ana giriş: OpenAI-stili gövdeyi alır, Claude native /v1/messages'a gönderir,
   OpenAI-stili SSE Response döndürür. Hata olursa (status, gövde) aynen yansıtılır
   → route'un mevcut `if (!upstream.ok)` hata işleme yolu çalışır. */
export async function anthropicUpstream(
  baseUrl: string,
  apiKey: string,
  body: OpenAIChatBody,
  signal?: AbortSignal,
): Promise<Response> {
  const { system, messages } = convertMessages(body.messages);
  const tools = convertTools(body.tools);
  const reqBody: Record<string, unknown> = {
    model: body.model,
    max_tokens: body.max_tokens || 8192,
    stream: true,
    messages,
  };
  if (system.length) reqBody.system = system;
  if (tools) reqBody.tools = tools;
  if (typeof body.temperature === "number") reqBody.temperature = body.temperature;

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(reqBody),
      signal,
    });
  } catch (err) {
    return new Response(`Claude'a bağlanılamadı: ${(err as Error).message}`, { status: 502 });
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    return new Response(detail || `Claude hatası (${res.status})`, { status: res.status || 500 });
  }
  return new Response(translateStream(res.body), {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
