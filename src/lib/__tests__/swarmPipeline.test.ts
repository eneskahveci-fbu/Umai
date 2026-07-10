import { describe, expect, it, vi } from "vitest";
import {
  MAX_AGENTS,
  ROLE_GUIDE,
  ROLE_ICON,
  VALID_ROLES,
  parseTasks,
  buildPlanPrompt,
  buildWorkerSystemPrompt,
  buildSynthSystemPrompt,
  runSwarmToCompletion,
} from "../swarmPipeline";
import type { LlmCfg } from "../llmCall";

describe("parseTasks", () => {
  it("geçerli JSON'dan görevleri çıkarır", () => {
    const raw = '{"tasks":[{"title":"A","role":"kodlayıcı","instruction":"yap"}]}';
    expect(parseTasks(raw)).toEqual([{ title: "A", role: "kodlayıcı", instruction: "yap" }]);
  });
  it("kod bloğu/fazla metin içindeki JSON'u da bulur", () => {
    const raw = 'İşte plan:\n```json\n{"tasks":[{"title":"B","role":"test","instruction":"i"}]}\n```\nbitti.';
    expect(parseTasks(raw)).toEqual([{ title: "B", role: "test", instruction: "i" }]);
  });
  it("geçersiz rolü 'genel'e düşürür", () => {
    const raw = '{"tasks":[{"title":"C","role":"uydurma-rol","instruction":"i"}]}';
    expect(parseTasks(raw)[0].role).toBe("genel");
  });
  it("instruction'ı olmayan görevi eler", () => {
    const raw = '{"tasks":[{"title":"D","role":"genel"},{"title":"E","role":"genel","instruction":"var"}]}';
    expect(parseTasks(raw)).toEqual([{ title: "E", role: "genel", instruction: "var" }]);
  });
  it("maxAgents ile sınırlar", () => {
    const raw = JSON.stringify({ tasks: Array.from({ length: 6 }, (_, i) => ({ title: `t${i}`, role: "genel", instruction: `i${i}` })) });
    expect(parseTasks(raw, 2)).toHaveLength(2);
  });
  it("JSON yoksa boş dizi", () => {
    expect(parseTasks("hiç json yok")).toEqual([]);
  });
  it("bozuk JSON'da boş dizi (fırlatmaz)", () => {
    expect(parseTasks('{"tasks": [ bozuk')).toEqual([]);
  });
});

describe("ROLE_GUIDE / VALID_ROLES / ROLE_ICON", () => {
  it("her rolün bir rehber metni ve ikonu var", () => {
    for (const role of VALID_ROLES) {
      expect(ROLE_GUIDE[role]).toBeTruthy();
      expect(ROLE_ICON[role]).toBeTruthy();
    }
  });
  it("'genel' rolü daima geçerlidir", () => {
    expect(VALID_ROLES).toContain("genel");
  });
});

describe("prompt builders", () => {
  it("buildPlanPrompt varsayılan MAX_AGENTS'ı kullanır", () => {
    expect(buildPlanPrompt()).toContain(String(MAX_AGENTS));
  });
  it("buildWorkerSystemPrompt bilinmeyen rol için genel rehberi kullanır", () => {
    expect(buildWorkerSystemPrompt("olmayan-rol")).toBe(buildWorkerSystemPrompt("genel"));
  });
  it("buildSynthSystemPrompt baseSys'i sona ekler", () => {
    expect(buildSynthSystemPrompt("TABAN")).toContain("TABAN");
  });
});

describe("runSwarmToCompletion", () => {
  const cfg: LlmCfg = { baseUrl: "https://x", model: "m", provider: "custom", headers: {} };

  it("planlayıcı tek görev döndürünce tek-ajan yanıtına düşer (ek plan çağrısı hariç 1 model çağrısı)", async () => {
    const fetchMock = vi.fn()
      // 1) planlama çağrısı — tek görev
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"tasks":[{"title":"tek","role":"genel","instruction":"yap"}]}' } }] }), { status: 200 }))
      // 2) tek-ajan yanıtı
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "nihai cevap" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runSwarmToCompletion({
      cfgs: [cfg], baseSys: "SYS", shared: [], userTask: "bir şey yap", signal: new AbortController().signal,
    });

    expect(result).toBe("nihai cevap");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("planlayıcı birden çok görev döndürünce paralel işçiler + birleştirme çalışır", async () => {
    const fetchMock = vi.fn()
      // 1) planlama — 2 görev
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"tasks":[{"title":"A","role":"mimar","instruction":"i1"},{"title":"B","role":"test","instruction":"i2"}]}' } }] }), { status: 200 }))
      // 2-4) işçiler + birleştirme — her çağrıda TAZE bir Response (body tek seferlik okunur)
      .mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: "işçi sonucu" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runSwarmToCompletion({
      cfgs: [cfg], baseSys: "SYS", shared: [], userTask: "büyük iş", signal: new AbortController().signal,
    });

    expect(result).toBe("işçi sonucu"); // son mock her çağrıda aynı yanıtı verir → birleştirici de bunu döner
    expect(fetchMock).toHaveBeenCalledTimes(4); // plan + 2 işçi + birleştirme
    vi.unstubAllGlobals();
  });

  it("bir aday hata verirse sıradakine geçer (yapışkan fallback)", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("ilk model çöktü"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"tasks":[{"title":"tek","role":"genel","instruction":"yap"}]}' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ikinci modelden cevap" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const cfg2: LlmCfg = { ...cfg, baseUrl: "https://y" };
    const result = await runSwarmToCompletion({
      cfgs: [cfg, cfg2], baseSys: "SYS", shared: [], userTask: "iş", signal: new AbortController().signal,
    });

    expect(result).toBe("ikinci modelden cevap");
    vi.unstubAllGlobals();
  });
});
