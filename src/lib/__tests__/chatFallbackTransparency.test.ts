import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";

/* Bug: kullanıcı anahtar gerektiren bir sağlayıcı (ör. openrouter) seçtiğinde
   ama o modele ait kullanılabilir bir API anahtarı sunucuya ulaşmadıysa
   (boş/çözülemedi), istek SESSİZCE ücretsiz Pollinations'a çevriliyordu —
   hiçbir hata/uyarı olmadan. Bu test, akışın İLK olayının artık açık bir
   fallback_event(reason:"no_key") olduğunu doğrular (bkz. chat/route.ts). */

function sseUpstreamResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Merhaba" }, finish_reason: null }] })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

async function readAllText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function firstEventOf(text: string): Record<string, unknown> {
  const line = text.split("\n\n").find((l) => l.startsWith("data:") && l.slice(5).trim() !== "[DONE]");
  return JSON.parse(line!.slice(5).trim());
}

describe("POST /api/chat — sessiz no-key fallback şeffaflığı", () => {
  const prevKey = process.env.LLM_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = prevKey;
  });

  it("anahtar gerektiren sağlayıcıda anahtar yoksa akışın ilk olayı fallback_event(reason:no_key) olur", async () => {
    delete process.env.LLM_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.1" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "selam" }],
        provider: "openrouter",
        model: "some/model",
        apiKey: "",
        baseUrl: "",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await readAllText(res);
    const ev = firstEventOf(text);
    expect(ev.fallback_event).toBeTruthy();
    const fb = ev.fallback_event as Record<string, unknown>;
    expect(fb.reason).toBe("no_key");
    expect(fb.requestedProvider).toBe("openrouter");
    expect(fb.requestedModel).toBe("some/model");
    expect(fb.provider).toBe("pollinations");
  });

  it("birincil aday başarısız olup bir sonraki adaya geçilirse akışın ilk olayı fallback_event (reason yok) olur", async () => {
    delete process.env.LLM_API_KEY;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("upstream hata", { status: 500 }))
      .mockResolvedValueOnce(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.3" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "selam" }],
        provider: "openrouter",
        model: "some/model",
        apiKey: "gecerli-anahtar",
        baseUrl: "",
        fallbacks: [{ provider: "pollinations", model: "openai", baseUrl: "https://text.pollinations.ai/openai" }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await readAllText(res);
    const ev = firstEventOf(text);
    expect(ev.fallback_event).toBeTruthy();
    const fb = ev.fallback_event as Record<string, unknown>;
    expect(fb.reason).toBeUndefined();
    expect(fb.provider).toBe("pollinations");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Pollinations zaten seçiliyse (anahtar gerekmiyor) hiçbir fallback_event yayınlanmaz", async () => {
    delete process.env.LLM_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(sseUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.2" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "selam" }],
        provider: "pollinations",
        model: "openai",
        apiKey: "",
        baseUrl: "",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await readAllText(res);
    expect(text).not.toContain("fallback_event");
  });
});
