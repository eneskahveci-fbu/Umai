import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";

/* jsonMode (bkz. slidesGen.ts'in sunum motoru): istemci SADECE geçerli JSON
   bekliyorsa, İYİ BELGELENMİŞ OpenAI-uyumlu sağlayıcılarda native
   response_format:json_object istenir; anahtarsız/ücretsiz toplayıcılarda
   (ör. pollinations) BİLİNÇLİ olarak istenmez (bkz. JSON_MODE_PROVIDERS
   yorumu, chat/route.ts) — bilinmeyen alanla 400 riskine girilmez. */

function sseUpstreamResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "{}" }, finish_reason: "stop" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("POST /api/chat — jsonMode → response_format", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("iyi belgelenmiş bir sağlayıcıda (groq) jsonMode → response_format:json_object gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.10" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "sadece JSON döndür" }],
        provider: "groq", model: "some/model", apiKey: "gk-test", baseUrl: "https://api.groq.com/openai/v1",
        jsonMode: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { response_format?: unknown };
    expect(sentBody.response_format).toEqual({ type: "json_object" });
  });

  it("anahtarsız/ücretsiz bir toplayıcıda (pollinations) jsonMode olsa da response_format GÖNDERMEZ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.11" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "sadece JSON döndür" }],
        provider: "pollinations", model: "openai", apiKey: "", baseUrl: "https://text.pollinations.ai/openai",
        jsonMode: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { response_format?: unknown };
    expect(sentBody.response_format).toBeUndefined();
  });

  it("jsonMode verilmezse (normal sohbet) iyi belgelenmiş sağlayıcıda bile response_format gönderilmez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.12" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "merhaba" }],
        provider: "groq", model: "some/model", apiKey: "gk-test", baseUrl: "https://api.groq.com/openai/v1",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { response_format?: unknown };
    expect(sentBody.response_format).toBeUndefined();
  });
});
