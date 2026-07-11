import { describe, it, expect, vi, afterEach } from "vitest";
import { extractJsonObject, streamChat } from "../genChat";

vi.mock("../studioGen", () => ({
  resolveKey: vi.fn(async () => ({ baseUrl: "https://example.test", model: "m", apiKey: "k", provider: "custom" })),
}));

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

describe("extractJsonObject", () => {
  it("düz JSON'u ayıklar", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("```json çitli bloktan ayıklar", () => {
    expect(extractJsonObject('metin\n```json\n{"a":1}\n```\nbitti')).toBe('{"a":1}');
  });

  it("iç içe süslü parantezleri doğru dengeler", () => {
    const raw = '{"a":{"b":1},"c":[1,2]}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("dizeler içindeki süslü parantezleri saymaz", () => {
    const raw = '{"text":"a { b } c"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("kaçış karakterli tırnakları doğru işler", () => {
    const raw = '{"text":"escaped \\" quote { with brace }"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("JSON yoksa hata fırlatır", () => {
    expect(() => extractJsonObject("hiç json yok")).toThrow();
  });

  it("tamamlanmamış JSON'da hata fırlatır", () => {
    expect(() => extractJsonObject('{"a": 1')).toThrow();
  });
});

describe("streamChat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("SSE delta'larını birleştirir ve onDelta'yı sırayla çağırır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Merhaba"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" dünya"}}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const result = await streamChat({
      system: "sen bir asistansın",
      messages: [{ role: "user", content: "selam" }],
      onDelta: (full) => deltas.push(full),
    });

    expect(result).toBe("Merhaba dünya");
    expect(deltas).toEqual(["Merhaba", "Merhaba dünya"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
  });

  it("satır sınırında bölünmüş chunk'ları doğru birleştirir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta"',
        ':{"content":"parça"}}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await streamChat({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(result).toBe("parça");
  });

  it("res.ok false ise hata fırlatır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(streamChat({ system: "s", messages: [] })).rejects.toThrow();
  });
});
