import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";

/* I2/I3: "efor" seviyesi artık sadece max_tokens'ı ölçeklemiyor, HER adayın
   KENDİ provider/model'ine göre gerçek API mekanizmasını da tetikliyor:
   - openrouter → reasoning:{effort}
   - doğrudan OpenAI o-serisi/gpt-5 → reasoning_effort (yeni — önceden hiç
     gönderilmiyordu)
   - Claude 3.7+/4.x (anthropic) → thinking:{type:enabled,budget_tokens} (yeni
     — anthropicUpstream thinking_delta'yı PASİF işliyordu ama hiç İSTEMİYORDU)
   Ayrıca eskiden bu karar TEK bir global `sampling` objesine yazılıp TÜM
   adaylara (birincil + fallback'ler, farklı sağlayıcılar dahil) spread
   ediliyordu — bir testte bunun artık sızmadığı da doğrulanıyor. */

function sseUpstreamResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "merhaba" }, finish_reason: "stop" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

/* Anthropic native SSE — anthropicUpstream'in translateStream'i bunu bekler. */
function anthropicSseResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

async function drain(res: Response): Promise<void> {
  const reader = res.body!.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
  }
}

describe("POST /api/chat — efor → gerçek API etkisi (I2/I3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("doğrudan OpenAI o-serisi modelde effort → reasoning_effort gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.20" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "openai", model: "o3-mini", apiKey: "sk-test", baseUrl: "https://api.openai.com/v1",
        effort: "high",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { reasoning_effort?: string; reasoning?: unknown };
    expect(sentBody.reasoning_effort).toBe("high");
    expect(sentBody.reasoning).toBeUndefined();
  });

  it("doğrudan OpenAI non-reasoning modelde (gpt-4o) reasoning_effort GÖNDERMEZ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.21" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "openai", model: "gpt-4o", apiKey: "sk-test", baseUrl: "https://api.openai.com/v1",
        effort: "high",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { reasoning_effort?: string };
    expect(sentBody.reasoning_effort).toBeUndefined();
  });

  it("openrouter'da effort → reasoning:{effort} gönderir (max → high eşlemesi)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.22" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "openrouter", model: "anthropic/claude-sonnet-4-5", apiKey: "or-test", baseUrl: "https://openrouter.ai/api/v1",
        effort: "max",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { reasoning?: { effort?: string } };
    expect(sentBody.reasoning).toEqual({ effort: "high" });
  });

  it("birincil openrouter başarısız olup groq fallback'e düşünce, groq'un gövdesinde reasoning SIZMAZ (eski sızıntı hatası düzeltildi)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("hata", { status: 500 }))
      .mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.23" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "openrouter", model: "some/model", apiKey: "or-test", baseUrl: "https://openrouter.ai/api/v1",
        effort: "high",
        fallbacks: [{ provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "gk-test", baseUrl: "https://api.groq.com/openai/v1" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await drain(res);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const groqCallBody = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as { reasoning?: unknown; reasoning_effort?: unknown };
    expect(groqCallBody.reasoning).toBeUndefined();
    expect(groqCallBody.reasoning_effort).toBeUndefined();
  });

  it("Claude 3.7+/4.x'te (anthropic, thinking destekli) effort → thinking:{type:enabled,budget_tokens} gönderir, temperature ATLANIR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicSseResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.24" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "anthropic", model: "claude-sonnet-4-5-20250929", apiKey: "sk-ant-test", baseUrl: "https://api.anthropic.com/v1",
        effort: "high", temperature: 0.7,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { thinking?: { type?: string; budget_tokens?: number }; temperature?: number };
    expect(sentBody.thinking).toEqual({ type: "enabled", budget_tokens: 12000 });
    expect(sentBody.temperature).toBeUndefined();
  });

  it("Claude 3.5'te (thinking desteklemez) effort verilse de thinking GÖNDERMEZ, temperature korunur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicSseResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.25" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "anthropic", model: "claude-3-5-sonnet-20241022", apiKey: "sk-ant-test", baseUrl: "https://api.anthropic.com/v1",
        effort: "high", temperature: 0.7,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { thinking?: unknown; temperature?: number };
    expect(sentBody.thinking).toBeUndefined();
    expect(sentBody.temperature).toBe(0.7);
  });
});
