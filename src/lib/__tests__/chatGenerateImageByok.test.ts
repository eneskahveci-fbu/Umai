import { afterEach, describe, expect, it, vi } from "vitest";

/* imageGen:true → wantsFullTools=true (route.ts) → durableSupabase hesaplanır
   (createClient() çağrılır). Gerçek createClient() Next.js istek-kapsamı
   DIŞINDA (vitest) cookies()'e erişip fırlar; guest/oturumsuz durumu simüle
   etmek için (üretimde de zaten null dönebilen) createClient'ı mock'la. */
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => null }));

import { POST } from "../../app/api/chat/route";

/* Bug: generate_image aracı HER ZAMAN anahtarsız Pollinations tabanına
   düşüyordu — kullanıcının Ayarlar → Model → Görsel üretimi'nde seçtiği/
   eklediği modelden TAMAMEN bağımsız ("Model X seçili ama Pollinations
   kullanılıyor" raporu). Bu test, istemcinin önceden çözdüğü BYOK sağlayıcısı
   (body.imageModel) verildiğinde route.ts'in kendi /api/image ucuna
   (ownOrigin üzerinden) BYOK isteği attığını ve sonucu kullandığını, BYOK
   başarısız olursa Pollinations'a düştüğünü doğrular. */

function toolCallUpstream(args: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "generate_image", arguments: args } }] } }],
      })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function textStopUpstream(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n`));
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

const baseBody = {
  messages: [{ role: "user", content: "bir kedi görseli yap" }],
  provider: "openrouter",
  model: "some/model",
  apiKey: "gecerli-anahtar",
  baseUrl: "https://openrouter.ai/api/v1",
  imageGen: true,
};

describe("POST /api/chat — generate_image BYOK önceliği", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("body.imageModel verilmişse önce /api/image'a BYOK isteği atar ve dönen görseli kullanır", async () => {
    const args = JSON.stringify({ prompt: "a cute cat" });
    const calls: string[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/image")) {
        return Promise.resolve(new Response(JSON.stringify({ image: "data:image/png;base64,AAAA" }), { status: 200 }));
      }
      // İlk LLM turu → tool-call; ikinci tur (tool sonrası) → düz metin.
      return Promise.resolve(calls.filter((c) => !c.includes("/api/image")).length === 1
        ? toolCallUpstream(args)
        : textStopUpstream("İşte görsel!"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.20" },
      body: JSON.stringify({ ...baseBody, imageModel: { provider: "gemini", apiKey: "gemini-key" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    await readAllText(res);
    expect(calls.some((c) => c.includes("/api/image"))).toBe(true);
    /* Pollinations'a HİÇ gidilmemeli — BYOK başarılı olduğunda. */
    expect(calls.some((c) => c.includes("pollinations"))).toBe(false);
  });

  it("BYOK isteği başarısız olursa Pollinations tabanına düşer (istek asla düşmez)", async () => {
    const args = JSON.stringify({ prompt: "a cute cat" });
    let llmCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/image")) {
        return Promise.resolve(new Response(JSON.stringify({ error: "quota aşıldı" }), { status: 402 }));
      }
      llmCallCount += 1;
      return Promise.resolve(llmCallCount === 1 ? toolCallUpstream(args) : textStopUpstream("İşte görsel!"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.21" },
      body: JSON.stringify({ ...baseBody, imageModel: { provider: "gemini", apiKey: "gemini-key" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await readAllText(res);
    /* tool_event bitiş satırında sonuç metni her koşulda "Görsel üretildi" olmalı
       (BYOK başarısız olsa bile Pollinations'a sessizce düşüldüğü için). */
    expect(text).toContain("Görsel üretildi");
  });

  it("body.imageModel verilmemişse (Ayarlar: Pollinations/BYOK yok) doğrudan Pollinations kullanılır", async () => {
    const args = JSON.stringify({ prompt: "a cute cat" });
    let llmCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url.includes("/api/image")).toBe(false); // BYOK'a hiç gidilmemeli
      llmCallCount += 1;
      return Promise.resolve(llmCallCount === 1 ? toolCallUpstream(args) : textStopUpstream("İşte görsel!"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.22" },
      body: JSON.stringify(baseBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    await readAllText(res);
  });
});
