import { afterEach, describe, expect, it, vi } from "vitest";
import { CRAFT_OPERATING_MANUAL } from "../constants";
import { POST } from "../../app/api/chat/route";

/* M1 (biçim disiplini) + M4 (dürüstlük) her sohbete eklenen
   CRAFT_OPERATING_MANUAL'da; M2 (üretilen kodu doğrula) run_code sunulduğunda
   sistem promptuna eklenir. Bu testler yönergelerin GERÇEKTEN modele gittiğini
   kilitler — prompt metni sessizce silinirse/kayarsa yakalanır. */

describe("M1 — biçim disiplini yönergesi", () => {
  it("her sohbete giden çalışma el kitabında yer alır", () => {
    expect(CRAFT_OPERATING_MANUAL).toContain("[BİÇİM DİSİPLİNİ");
  });

  it("aşırı biçimlendirmeye karşı somut kurallar içerir", () => {
    expect(CRAFT_OPERATING_MANUAL).toContain("Emoji kullanma");
    expect(CRAFT_OPERATING_MANUAL).toMatch(/madde listelerine ve bölümlere BÖLME/i);
    expect(CRAFT_OPERATING_MANUAL).toMatch(/umarım yardımcı olmuştur/i); // dolgu yasağı
  });
});

describe("M4 — dürüstlük yönergesi", () => {
  it("her sohbete giden çalışma el kitabında yer alır", () => {
    expect(CRAFT_OPERATING_MANUAL).toContain("[DÜRÜSTLÜK");
  });

  it("uydurmama ve belirsizliği açıkça söyleme kurallarını içerir", () => {
    expect(CRAFT_OPERATING_MANUAL).toMatch(/UYDURMA/);
    expect(CRAFT_OPERATING_MANUAL).toMatch(/bilmiyorum/i);
    /* Doğrulamadan "test ettim" dememe — L1 ile birlikte anlamlı hale geldi. */
    expect(CRAFT_OPERATING_MANUAL).toMatch(/test ettim/i);
  });

  it("tahmin yerine araç kullanmayı söyler (read_file/run_code/web_search)", () => {
    expect(CRAFT_OPERATING_MANUAL).toContain("run_code");
    expect(CRAFT_OPERATING_MANUAL).toContain("web_search");
  });
});

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

async function drain(res: Response): Promise<void> {
  const reader = res.body!.getReader();
  for (;;) { const { done } = await reader.read(); if (done) break; }
}

function sentSystemPrompt(fetchMock: ReturnType<typeof vi.fn>): string {
  const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
    messages: { role: string; content: string }[];
  };
  return body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
}

const KEYED = {
  provider: "groq", model: "llama-3.3-70b-versatile",
  apiKey: "gk-test", baseUrl: "https://api.groq.com/openai/v1",
};

describe("M2 — üretilen kodu doğrulama yönergesi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("run_code sunulduğunda sistem promptuna eklenir", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.50" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...KEYED, codeExec: true }),
    });
    await drain(await POST(req));
    const sys = sentSystemPrompt(fetchMock);
    expect(sys).toContain("[Analiz aracı]");
    expect(sys).toMatch(/SUNMADAN ÖNCE run_code ile çalıştırıp/);
    /* Her kod parçasını değil, yalnız doğruluğu önemli olanları çalıştırsın. */
    expect(sys).toMatch(/Dış bağımlılık, ağ, dosya/);
  });

  it("run_code sunulmadığında bu yönerge eklenmez (yanıltıcı talimat olmasın)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.51" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...KEYED }),
    });
    await drain(await POST(req));
    expect(sentSystemPrompt(fetchMock)).not.toContain("[Analiz aracı]");
  });
});
