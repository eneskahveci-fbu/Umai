import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";

/* L1 (analiz aracı) + L2 (organik web arama):
   - run_code, kod SUNUCUDA çalıştırılmadan istemciye olay olarak yollanmalı
     (LLM'in ürettiği kodu kendi sunucumuzda çalıştırmak env/iç ağ erişimi
     demek olurdu — kasıtlı olarak yapılmıyor).
   - web_search/read_url artık autoWeb() regex'ine bağlı DEĞİL: tool-yetenekli
     sağlayıcılarda her zaman sunulur, kararı model verir.
   - Anahtarsız uçlarda (Pollinations vb.) HİÇBİR araç eklenmez — A1'in
     zero-copy hızlı yolu ve 400 riski koruması aynen sürer. */

function sseWithToolCall(name: string, args: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name, arguments: args } }] } }],
      })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function sseText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: "stop" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

function toolNamesSent(fetchMock: ReturnType<typeof vi.fn>): string[] {
  const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
    tools?: { function: { name: string } }[];
  };
  return (body.tools ?? []).map((t) => t.function.name);
}

const KEYED = {
  provider: "groq", model: "llama-3.3-70b-versatile",
  apiKey: "gk-test", baseUrl: "https://api.groq.com/openai/v1",
};

describe("POST /api/chat — L1: run_code analiz aracı", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("codeExec true ise run_code aracı modele sunulur", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.40" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...KEYED, codeExec: true }),
    });
    await readAll(await POST(req));
    expect(toolNamesSent(fetchMock)).toContain("run_code");
  });

  it("codeExec verilmezse run_code sunulmaz (çıktıyı geri besleyecek istemci yok)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.41" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...KEYED }),
    });
    await readAll(await POST(req));
    expect(toolNamesSent(fetchMock)).not.toContain("run_code");
  });

  it("model run_code çağırınca kodu SUNUCUDA çalıştırmaz, istemciye olay olarak yollar", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => sseWithToolCall("run_code", JSON.stringify({ language: "python", code: "print(2+2)" })))
      .mockImplementation(async () => sseText("Sonuç 4."));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.42" },
      body: JSON.stringify({ messages: [{ role: "user", content: "2+2 kaç?" }], ...KEYED, codeExec: true }),
    });
    const out = await readAll(await POST(req));
    expect(out).toContain("run_code_event");
    expect(out).toContain("print(2+2)");
    /* Sunucu yalnız LLM uçlarına gitti — kod çalıştıran hiçbir yan etki yok. */
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain("api.groq.com");
    }
  });

  it("boş kod gönderilirse olay yayınlamaz, anlaşılır hata döner", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => sseWithToolCall("run_code", JSON.stringify({ language: "python", code: "   " })))
      .mockImplementation(async () => sseText("tamam"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.43" },
      body: JSON.stringify({ messages: [{ role: "user", content: "x" }], ...KEYED, codeExec: true }),
    });
    const out = await readAll(await POST(req));
    expect(out).not.toContain("run_code_event");
    expect(out).toContain("code gerekli");
  });
});

describe("POST /api/chat — L2: organik web arama kararı", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("webSearch bayrağı OLMADAN da web_search/read_url modele sunulur (kararı model verir)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.44" },
      body: JSON.stringify({ messages: [{ role: "user", content: "dolar kaç TL?" }], ...KEYED }),
    });
    await readAll(await POST(req));
    const names = toolNamesSent(fetchMock);
    expect(names).toContain("web_search");
    expect(names).toContain("read_url");
  });

  it("blockNetworkTools açıkken web araçları sunulmaz (güvenlik kapısı korunur)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.45" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...KEYED, blockNetworkTools: true }),
    });
    await readAll(await POST(req));
    expect(toolNamesSent(fetchMock)).not.toContain("web_search");
  });

  it("anahtarsız uçta (pollinations) HİÇ araç gönderilmez — A1 zero-copy hızlı yolu korunur", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.46" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "selam" }],
        provider: "pollinations", model: "openai", apiKey: "", baseUrl: "https://text.pollinations.ai/openai",
        codeExec: true,
      }),
    });
    await readAll(await POST(req));
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { tools?: unknown };
    expect(body.tools).toBeUndefined();
  });
});
