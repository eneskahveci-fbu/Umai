import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";

/* Bug: ask_user aracı (Claude'daki gibi tıklanabilir anket kartı) yalnızca
   repo bağlıyken (body.tools && body.repoCtx) sunuluyordu — düz sohbette
   (repo yok, Tools kapalı) model bir netleştirme sorusu sormak istediğinde
   bu araç hiç tanımlı olmadığından çağrılamıyor, yanıt düz markdown olarak
   kalıyordu. Bu test, repoCtx OLMADAN gönderilen bir istekte upstream'in
   ask_user tool-call'ının gerçekten algılanıp ask_user_event olarak akışa
   yansıdığını doğrular (bkz. chat/route.ts — allTools artık ask_user'ı her
   modda içerir). */

function toolCallUpstreamResponse(): Response {
  const encoder = new TextEncoder();
  const args = JSON.stringify({
    questions: [
      { header: "Dil", question: "Hangi dilde yazayım?", options: [{ label: "TypeScript" }, { label: "Python" }] },
    ],
  });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "ask_user", arguments: args } }] } }],
      })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`));
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

describe("POST /api/chat — ask_user düz sohbette (repo bağlı değilken) de çalışır", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("repoCtx/tools olmadan gönderilen istekte ask_user tool-call'ı ask_user_event'e dönüşür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(toolCallUpstreamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.10" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "bir hesap makinesi yap" }],
        provider: "pollinations",
        model: "openai",
        apiKey: "",
        baseUrl: "https://text.pollinations.ai/openai",
        // repoCtx yok, tools/webSearch/imageGen yok — tamamen düz sohbet.
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await readAllText(res);
    const eventLine = text.split("\n\n").find((l) => l.includes("ask_user_event"));
    expect(eventLine).toBeTruthy();
    const parsed = JSON.parse(eventLine!.slice(5).trim());
    expect(parsed.ask_user_event.questions[0].header).toBe("Dil");
    expect(parsed.ask_user_event.questions[0].options).toHaveLength(2);
  });
});
