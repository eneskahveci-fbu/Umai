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

/* Pollinations artık SUNUCUDA çekilip doğrulanıyor (eskiden yalnız bir URL
   metni kuruluyordu). Gerçek bir görsel yanıtını taklit eder. */
function pollinationsImageResponse(): Response {
  return new Response(new Uint8Array([137, 80, 78, 71]), {
    status: 200,
    headers: { "Content-Type": "image/jpeg" },
  });
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
      if (url.includes("pollinations")) return Promise.resolve(pollinationsImageResponse());
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
      if (url.includes("pollinations")) return Promise.resolve(pollinationsImageResponse());
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

  it("hiçbir sağlayıcı üretemezse 'üretildi' DEMEZ — dürüstçe başarısızlık bildirir (IMG_1174)", async () => {
    /* Canlı hata: araç 255 ms'de "Görsel üretildi" diyor, model "işte
       görselin" yazıyordu; oysa yalnızca bir Pollinations URL METNİ
       kurulmuştu (pollinationsImageUrl hiç ağa çıkmaz). Gerçek üretim
       tarayıcı <img>'i yüklerken başlıyor, Pollinations dolu/yavaş olduğunda
       kullanıcı uzun bekleyip KIRIK görsel görüyordu. */
    const args = JSON.stringify({ prompt: "a knight with a sword" });
    let llmCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/image")) {
        return Promise.resolve(new Response(JSON.stringify({ error: "quota" }), { status: 402 }));
      }
      /* Pollinations de ayakta değil (503) → hiçbir görsel yok. */
      if (url.includes("pollinations")) {
        return Promise.resolve(new Response("upstream down", { status: 503 }));
      }
      llmCallCount += 1;
      return Promise.resolve(llmCallCount === 1 ? toolCallUpstream(args) : textStopUpstream("tamam"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.23" },
      body: JSON.stringify({ ...baseBody, imageModel: { provider: "gemini", apiKey: "gk" } }),
    });
    const text = await readAllText(await POST(req));

    expect(text).not.toContain("Görsel üretildi");
    expect(text).toContain("Görsel üretilemedi");
  });

  /* Kullanıcı hata raporu (Tem 2026, ekran görüntüsü): görsel üretilince
     sohbete ham "![...](data:image/jpeg;base64,/9j/4QPARX…" metni dökülüyordu.
     Sebep: araç sonucu olarak MODELE bir veri-URL'i veriliyor ve sistem promptu
     "bunu yanıtına göm" diyordu; base64 yüz binlerce token olduğundan model
     kopyalarken yarıda kesiliyordu. Görsel artık modele HİÇ gitmez — ayrı bir
     image_event ile doğrudan istemciye ulaşır. */
  it("görsel MODELE gitmez: araç sonucunda base64/veri-URL'i bulunmaz", async () => {
    const args = JSON.stringify({ prompt: "a knight" });
    let llmCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      void init;
      if (url.includes("pollinations")) return Promise.resolve(pollinationsImageResponse());
      llmCallCount += 1;
      return Promise.resolve(llmCallCount === 1 ? toolCallUpstream(args) : textStopUpstream("tamam"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.24" },
      body: JSON.stringify(baseBody),
    });
    await readAllText(await POST(req));

    const llmCalls = fetchMock.mock.calls.filter((c) => !String(c[0]).includes("pollinations"));
    const lastLlmBody = JSON.parse(
      String((llmCalls.at(-1)?.[1] as RequestInit | undefined)?.body ?? "{}"),
    ) as { messages: { role: string; content?: string }[] };
    const toolMsg = lastLlmBody.messages.find((m) => m.role === "tool");
    const toolText = toolMsg?.content ?? "";
    expect(toolText).not.toContain("data:image");
    expect(toolText).not.toMatch(/;base64,/);
    expect(toolText).not.toContain("![");
    /* Kısa kalmalı — eskiden tüm görsel gövdesi buraya giriyordu. */
    expect(toolText.length).toBeLessThan(400);
    /* Yine de modele üretimin BAŞARILI olduğu bildirilmeli. */
    expect(toolText).toContain("üretildi");
  });

  /* Görsel kaybolmuyor: sunucuda doğrulanıp çekilen veri-URL'i istemciye
     image_event ile ulaşır (tarayıcı ikinci kez üretmez — bu davranış korunur). */
  it("görsel istemciye image_event ile veri-URL'i olarak ulaşır", async () => {
    const args = JSON.stringify({ prompt: "a knight" });
    let llmCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      void init;
      if (url.includes("pollinations")) return Promise.resolve(pollinationsImageResponse());
      llmCallCount += 1;
      return Promise.resolve(llmCallCount === 1 ? toolCallUpstream(args) : textStopUpstream("tamam"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.25" },
      body: JSON.stringify(baseBody),
    });
    const out = await readAllText(await POST(req));
    expect(out).toContain("image_event");
    expect(out).toContain("data:image/jpeg;base64,");
  });
});
