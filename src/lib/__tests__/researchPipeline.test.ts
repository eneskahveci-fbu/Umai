import { describe, expect, it, vi } from "vitest";
import { runDeepResearch } from "../researchPipeline";
import type { LlmCfg } from "../llmCall";

describe("runDeepResearch", () => {
  const cfg: LlmCfg = { baseUrl: "https://x", model: "m", provider: "custom", headers: {} };

  it("boş konuda hiç ağ çağrısı yapmadan nazik bir mesaj döner", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    const result = await runDeepResearch(cfg, "  ", "SYS", { onSynthChunk: (c) => chunks.push(c) });

    expect(result).toBe("Araştırılacak bir konu bulunamadı.");
    expect(chunks).toEqual([result]);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("arama sonuç bulamazsa nazik bir mesajla biter (planlama + arama sonrası)", async () => {
    const fetchMock = vi.fn()
      // 1) planlama
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"queries":["tek sorgu"]}' } }] }), { status: 200 }))
      // 2) arama (DuckDuckGo html) — boş sonuç
      .mockResolvedValueOnce(new Response("<html></html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const phases: string[] = [];
    const result = await runDeepResearch(cfg, "hiçbir sonuç yok konusu", "SYS", {
      onPhase: (phase) => phases.push(phase),
    });

    expect(result).toContain("Web aramasından sonuç alınamadı");
    expect(phases).toEqual(["planning", "working", "working", "done"]);
    vi.unstubAllGlobals();
  });

  it("kaynak bulununca atıflı rapor akışlı olarak üretilir", async () => {
    const searchHtml =
      'result__body"><a class="result__a" href="https://example.com/a">Örnek Kaynak A</a>' +
      '<a class="result__snippet">kısa özet</a>';
    const sse = 'data: {"choices":[{"delta":{"content":"Merhaba "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"dünya"}}]}\n\n' +
      "data: [DONE]\n\n";

    const fetchMock = vi.fn()
      // 1) planlama
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"queries":["konu A"]}' } }] }), { status: 200 }))
      // 2) arama
      .mockResolvedValueOnce(new Response(searchHtml, { status: 200 }))
      // 3) sayfa okuma (fetchUrl → r.jina.ai proxy)
      .mockResolvedValueOnce(new Response("sayfa içeriği burada", { status: 200 }))
      // 4) sentez (streamModel, SSE)
      .mockResolvedValueOnce(new Response(sse, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    const phases: string[] = [];
    const result = await runDeepResearch(cfg, "konu A", "SYS", {
      onPhase: (phase) => phases.push(phase),
      onSynthChunk: (c) => chunks.push(c),
    });

    expect(result).toBe("Merhaba dünya");
    expect(chunks.join("")).toBe("Merhaba dünya");
    expect(phases).toEqual(["planning", "working", "working", "synthesizing", "done"]);
    vi.unstubAllGlobals();
  });
});
