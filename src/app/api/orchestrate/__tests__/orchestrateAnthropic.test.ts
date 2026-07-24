import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

/* J1/J3: /api/orchestrate ("Ajan Ekibi") kendi kodunda "Claude Code tarzı"
   diye tanımlanıyor ama provider==="anthropic" olduğunda HER ZAMAN
   `${baseUrl}/chat/completions`'a (Anthropic'te böyle bir uç YOK) OpenAI
   şekilli bir istek atıyordu — aktif swarm modeli Claude ise bu uç
   başarısız oluyordu. Bu testler artık doğru native uca (x-api-key ile
   /messages) gittiğini VE efor seviyesinin gerçekten thinking bütçesine
   (Claude 3.7+/4.x) ya da reasoning_effort'a (doğrudan OpenAI o-serisi)
   dönüştüğünü doğrular — chat/route.ts'teki I2/I3'ün orchestrate karşılığı. */

function anthropicSseSingleTask(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Merhaba, plan basit — tek görev." } })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function openaiSse(content: string): Response {
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

async function drain(res: Response): Promise<void> {
  const reader = res.body!.getReader();
  for (;;) { const { done } = await reader.read(); if (done) break; }
}

describe("POST /api/orchestrate — Claude modeliyle native uca doğru gider (J1)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("provider anthropic ise planlayıcı çağrısı /v1/messages'a (x-api-key ile) gider", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => anthropicSseSingleTask());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.30" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "basit bir görev" }],
        provider: "anthropic", model: "claude-sonnet-4-5-20250929", apiKey: "sk-ant-test", baseUrl: "https://api.anthropic.com/v1",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await drain(res);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/messages");
    expect(url).not.toContain("/chat/completions");
    const opts = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(opts.headers["x-api-key"]).toBe("sk-ant-test");
  });

  it("Claude 3.7+/4.x + effort → thinking bütçesi gönderir", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => anthropicSseSingleTask());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.31" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "basit bir görev" }],
        provider: "anthropic", model: "claude-sonnet-4-5-20250929", apiKey: "sk-ant-test", baseUrl: "https://api.anthropic.com/v1",
        effort: "high",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await drain(res);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { thinking?: { type?: string; budget_tokens?: number } };
    expect(sentBody.thinking).toEqual({ type: "enabled", budget_tokens: 12000 });
  });

  it("doğrudan OpenAI o-serisinde effort → reasoning_effort gönderir (I3'ün orchestrate karşılığı)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => openaiSse("plan: tek görev"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.32" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "basit bir görev" }],
        provider: "openai", model: "o3-mini", apiKey: "sk-test", baseUrl: "https://api.openai.com/v1",
        effort: "high",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await drain(res);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { reasoning_effort?: string };
    expect(sentBody.reasoning_effort).toBe("high");
  });

  it("groq gibi bir sağlayıcıda eskisi gibi /chat/completions'a gider (regresyon yok)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => openaiSse("plan: tek görev"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.33" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "basit bir görev" }],
        provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "gk-test", baseUrl: "https://api.groq.com/openai/v1",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await drain(res);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/chat/completions");
  });
});
