import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";

/* R1/R3 — sağlayıcıya GERÇEKTEN giden sistem promptunu doğrular: kimlik bloğu
   her istekte var mı, 11 KB'lik platform rehberi yalnız gerektiğinde mi
   ekleniyor. */

function sseText(text: string): Response {
  const enc = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: "stop" }] })}\n\n`));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

async function drain(res: Response): Promise<void> {
  const r = res.body!.getReader();
  for (;;) { const { done } = await r.read(); if (done) break; }
}

/** Tek bir istek gönderip sağlayıcıya giden sistem promptunu döndürür. */
async function systemPromptFor(
  opts: { provider: string; model: string; text: string; ip: string },
): Promise<string> {
  const fetchMock = vi.fn().mockImplementation(async () => sseText("ok"));
  vi.stubGlobal("fetch", fetchMock);
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": opts.ip },
    body: JSON.stringify({
      messages: [{ role: "user", content: opts.text }],
      provider: opts.provider, model: opts.model,
      apiKey: "test-key", baseUrl: "https://example.test/v1",
    }),
  });
  await drain(await POST(req));
  const sent = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
    messages: { role: string; content: string }[];
    /* Anthropic native yolu (anthropic.ts convertMessages) system'i mesaj
       dizisinde DEĞİL, üst seviye blok dizisinde taşır — ikisi de okunur. */
    system?: { text?: string }[];
  };
  return [
    ...(sent.system ?? []).map((b) => b.text ?? ""),
    ...sent.messages.filter((m) => m.role === "system").map((m) => m.content),
  ].join("\n");
}

describe("sistem promptunda model kimliği (R1)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gerçek model adını ve üreticisini gönderir", async () => {
    const sys = await systemPromptFor({
      provider: "anthropic", model: "claude-opus-4-8", text: "merhaba", ip: "9.9.9.80",
    });
    expect(sys).toContain("[MODEL KİMLİĞİ]");
    expect(sys).toContain("Anthropic'in Claude Opus 4.8 modeli");
    expect(sys).toContain("Umai platformunda çalışıyorsun");
  });

  it("modeli sunan sağlayıcı üreticiden farklıysa ikisini de yazar", async () => {
    const sys = await systemPromptFor({
      provider: "nvidia", model: "meta/llama-3.3-70b-instruct", text: "merhaba", ip: "9.9.9.81",
    });
    expect(sys).toContain("Meta'nın Llama 3.3 70B Instruct modeli");
    expect(sys).toContain("NVIDIA NIM");
  });

  it("artık 'yalnızca UMAI de' talimatı gönderilmiyor", async () => {
    const sys = await systemPromptFor({
      provider: "openai", model: "gpt-4o", text: "sen hangi modelsin", ip: "9.9.9.82",
    });
    expect(sys).not.toMatch(/YALNIZCA "UMAI" de/);
    expect(sys).toContain("OpenAI'ın GPT-4o modeli");
  });
});

describe("platform rehberi iki kademeli gönderilir (R3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sıradan istekte yalnız kısa dizin gider — 11 KB'lik tam rehber GİTMEZ", async () => {
    const sys = await systemPromptFor({
      provider: "groq", model: "llama-3.3-70b-versatile",
      text: "bana bir fibonacci fonksiyonu yaz", ip: "9.9.9.83",
    });
    expect(sys).toContain("[UMAI — içinde çalıştığın uygulama]");
    expect(sys).not.toContain("[UMAI platform rehberi");
  });

  it("arayüz sorusunda tam rehber de gider", async () => {
    const sys = await systemPromptFor({
      provider: "groq", model: "llama-3.3-70b-versatile",
      text: "Stüdyo'da sunum nasıl yaparım?", ip: "9.9.9.84",
    });
    expect(sys).toContain("[UMAI platform rehberi");
  });

  it("kısaltma sistem promptunu gerçekten küçültür", async () => {
    const plain = await systemPromptFor({
      provider: "groq", model: "llama-3.3-70b-versatile", text: "merhaba", ip: "9.9.9.85",
    });
    const ui = await systemPromptFor({
      provider: "groq", model: "llama-3.3-70b-versatile", text: "Ayarlar nerede?", ip: "9.9.9.86",
    });
    /* Tam rehber ~11 KB; sıradan istekte bu yük taşınmamalı. */
    expect(ui.length - plain.length).toBeGreaterThan(8000);
  });
});

describe("yedeğe düşünce kimlik de DEĞİŞİR (canlı hata: IMG_1173)", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Belirli bir uca giden isteğin sistem metnini toplar. */
  function sysOfCall(mock: ReturnType<typeof vi.fn>, i: number): string {
    const sent = JSON.parse(mock.mock.calls[i]![1]!.body as string) as {
      messages: { role: string; content: string }[];
      system?: { text?: string }[];
    };
    return [
      ...(sent.system ?? []).map((b) => b.text ?? ""),
      ...sent.messages.filter((m) => m.role === "system").map((m) => m.content),
    ].join("\n");
  }

  it("birincil (NVIDIA/DeepSeek) düşüp Gemini devralınca Gemini'ye GEMINI kimliği gider", async () => {
    /* Canlıda görülen hata: aktif model NVIDIA NIM (bir DeepSeek modeli),
       istek gemini-2.5-flash'e düştü, ama yanıt "DeepSeek V4 Pro modeliyim"
       dedi. Sebep: kimlik bloğu istek başında BİRİNCİL adaya göre bir kez
       yazılıyordu; devralan model kendisine söylenen yanlış kimliği itaatle
       tekrarlıyordu. */
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }))
      .mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.90" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hangi modelsin" }],
        provider: "nvidia", model: "deepseek-ai/deepseek-v3",
        apiKey: "nvapi-x", baseUrl: "https://integrate.api.nvidia.com/v1",
        fallbacks: [{
          provider: "gemini", model: "models/gemini-2.5-flash", apiKey: "gk",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        }],
      }),
    });
    await drain(await POST(req));

    /* 0. çağrı birincil (NVIDIA) → DeepSeek kimliği doğru. */
    const primarySys = sysOfCall(fetchMock, 0);
    expect(primarySys).toContain("DeepSeek");

    /* 1. çağrı yedek (Gemini) → kimlik ARTIK Google/Gemini olmalı,
       DeepSeek'ten hiç söz edilmemeli. */
    const fallbackSys = sysOfCall(fetchMock, 1);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("generativelanguage");
    expect(fallbackSys).toContain("Gemini");
    expect(fallbackSys).not.toContain("DeepSeek");
  });
});
