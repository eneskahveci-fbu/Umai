import { afterEach, describe, expect, it, vi } from "vitest";
import { runReadOnlyAgent, type SubAgentCfg } from "../subagent";
import type { RepoReadCtx } from "../repoRead";

/* J1: dispatch_agents/orchestrate'in paylaştığı alt-ajan çalıştırıcı, Claude
   modelinde önceden HER ZAMAN `${baseUrl}/chat/completions`'a (Anthropic'te
   böyle bir uç YOK — gerçek uç /v1/messages) OpenAI şekilli bir gövdeyle
   istek atıyordu. Bu testler artık provider==="anthropic" iken doğru native
   uca (x-api-key başlığıyla /messages) gittiğini, diğer sağlayıcılarda ise
   eski davranışın (OpenAI-uyumlu /chat/completions) korunduğunu doğrular. */

function openaiSseNoTools(content: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function anthropicSseNoTools(content: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: content } })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const ctx: RepoReadCtx = { owner: "o", repo: "r", branch: "main", provider: "github" };

describe("runReadOnlyAgent — J1: Claude native uca doğru yönlendirme", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("provider anthropic İSE /v1/messages'a (x-api-key ile) gider, /chat/completions'a DEĞİL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicSseNoTools("merhaba"));
    vi.stubGlobal("fetch", fetchMock);
    const cfg: SubAgentCfg = {
      baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5-20250929", provider: "anthropic",
      headers: {}, apiKey: "sk-ant-test",
    };
    const out = await runReadOnlyAgent(cfg, [{ role: "user", content: "selam" }], ctx);
    expect(out).toBe("merhaba");
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/messages");
    expect(url).not.toContain("/chat/completions");
    const opts = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(opts.headers["x-api-key"]).toBe("sk-ant-test");
  });

  it("provider anthropic DIŞINDA (ör. groq) eskisi gibi /chat/completions'a gider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openaiSseNoTools("selam sana"));
    vi.stubGlobal("fetch", fetchMock);
    const cfg: SubAgentCfg = {
      baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", provider: "groq",
      headers: { Authorization: "Bearer gk-test" }, apiKey: "gk-test",
    };
    const out = await runReadOnlyAgent(cfg, [{ role: "user", content: "selam" }], ctx);
    expect(out).toBe("selam sana");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/chat/completions");
  });

  it("Claude'da da araç çağırma döngüsü çalışır (tool_use → tool_result → nihai metin)", async () => {
    const encoder = new TextEncoder();
    const toolCallSse = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "tool_use", id: "call_1", name: "list_files" } })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{}" } })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" } })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
        controller.close();
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(toolCallSse, { status: 200, headers: { "Content-Type": "text/event-stream" } }))
      /* executeReadTool("list_files") → GitHub ağaç API'sine gerçek bir çağrı yapar. */
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [{ path: "a.ts", type: "blob" }] }), { status: 200 }))
      .mockResolvedValueOnce(anthropicSseNoTools("dosyaları inceledim, sonuç: X"));
    vi.stubGlobal("fetch", fetchMock);
    const cfg: SubAgentCfg = {
      baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5-20250929", provider: "anthropic",
      headers: {}, apiKey: "sk-ant-test",
    };
    const out = await runReadOnlyAgent(cfg, [{ role: "user", content: "dosyaları listele" }], ctx);
    expect(out).toBe("dosyaları inceledim, sonuç: X");
    expect(fetchMock.mock.calls.length).toBe(3);
  });
});
