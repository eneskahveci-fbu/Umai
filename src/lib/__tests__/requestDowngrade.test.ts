import { describe, expect, it } from "vitest";
import { downgradeRequest, isOpenAiReasoningModel, adaptForOpenAiReasoning } from "../requestDowngrade";

/* P1/P2 — "istediğim model cevap vermiyor, diğer modele geçildi" şikayetinin
   kök nedeni: gönderdiğimiz opsiyonel alanları desteklemeyen modellerde 400
   alınıp doğrudan fallback'e geçiliyordu. */

function base(): Record<string, unknown> {
  return {
    model: "meta/llama-3.3-70b-instruct",
    messages: [],
    stream: true,
    max_tokens: 32768,
    temperature: 0.7,
    tools: [{ type: "function" }],
    tool_choice: "auto",
    response_format: { type: "json_object" },
    reasoning_effort: "high",
  };
}

describe("downgradeRequest — hata metnindeki alanı hedefler", () => {
  it("araç desteklenmiyorsa tools/tool_choice düşer, gerisi KALIR", () => {
    const r = downgradeRequest(base(), '{"error":{"message":"This model does not support tools"}}')!;
    expect(r.body.tools).toBeUndefined();
    expect(r.body.tool_choice).toBeUndefined();
    expect(r.body.max_tokens).toBe(32768);      // dokunulmadı
    expect(r.body.temperature).toBe(0.7);       // dokunulmadı
    expect(r.dropped).toContain("tools");
  });

  it("function calling ifadesini de yakalar", () => {
    const r = downgradeRequest(base(), "function calling is not supported for this model")!;
    expect(r.body.tools).toBeUndefined();
  });

  it("JSON modu desteklenmiyorsa yalnız response_format düşer", () => {
    const r = downgradeRequest(base(), "response_format is not supported")!;
    expect(r.body.response_format).toBeUndefined();
    expect(r.body.tools).toBeDefined();
  });

  it("reasoning desteklenmiyorsa reasoning alanları düşer", () => {
    const r = downgradeRequest(base(), "Unknown parameter: 'reasoning_effort'")!;
    expect(r.body.reasoning_effort).toBeUndefined();
    expect(r.body.tools).toBeDefined();
  });

  it("temperature desteklenmiyorsa temperature/top_p düşer", () => {
    const r = downgradeRequest({ ...base(), top_p: 0.9 }, "temperature is not supported with this model")!;
    expect(r.body.temperature).toBeUndefined();
    expect(r.body.top_p).toBeUndefined();
  });
});

describe("downgradeRequest — token alanı", () => {
  it("max_completion_tokens isteniyorsa alan ADINI değiştirir, değeri korur", () => {
    const r = downgradeRequest(base(), "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.")!;
    expect(r.body.max_tokens).toBeUndefined();
    expect(r.body.max_completion_tokens).toBe(32768);
    expect(r.dropped).toContain("max_tokens→max_completion_tokens");
  });

  it("değer çok büyükse güvenli sınıra çeker", () => {
    const r = downgradeRequest(base(), "max_tokens must be <= 4096")!;
    expect(r.body.max_tokens).toBe(4096);
  });

  it("zaten küçük bir max_tokens'ı gereksiz yere değiştirmez", () => {
    const r = downgradeRequest({ ...base(), max_tokens: 512 }, "max_tokens invalid");
    /* Bu hata için düşürecek bir şey yok → genel düşürmeye geçer. */
    expect(r).not.toBeNull();
    expect(r!.body.max_tokens).toBe(512);
  });
});

describe("downgradeRequest — belirsiz 400", () => {
  it("hata alan belirtmiyorsa TÜM opsiyonel alanları tek seferde düşürür", () => {
    const r = downgradeRequest(base(), "Bad Request")!;
    expect(r.body.tools).toBeUndefined();
    expect(r.body.tool_choice).toBeUndefined();
    expect(r.body.response_format).toBeUndefined();
    expect(r.body.reasoning_effort).toBeUndefined();
    expect(r.body.max_tokens).toBe(4096);
    /* Zorunlu alanlar korunur. */
    expect(r.body.model).toBe("meta/llama-3.3-70b-instruct");
    expect(r.body.stream).toBe(true);
  });

  it("düşürülecek hiçbir şey kalmadıysa null döner (çağıran fallback'e geçer)", () => {
    const minimal = { model: "m", messages: [], stream: true };
    expect(downgradeRequest(minimal, "Bad Request")).toBeNull();
  });
});

describe("isOpenAiReasoningModel / adaptForOpenAiReasoning (P2)", () => {
  it("yalnız doğrudan OpenAI'daki o-serisi ve gpt-5'i tanır", () => {
    expect(isOpenAiReasoningModel("openai", "o3-mini")).toBe(true);
    expect(isOpenAiReasoningModel("openai", "gpt-5")).toBe(true);
    expect(isOpenAiReasoningModel("openai", "gpt-4o")).toBe(false);
    /* Aynı model openrouter üzerinden gelirse OpenAI'a özgü kural uygulanmaz. */
    expect(isOpenAiReasoningModel("openrouter", "openai/o3-mini")).toBe(false);
  });

  it("max_tokens'ı max_completion_tokens'a çevirir ve temperature/top_p'yi kaldırır", () => {
    const out = adaptForOpenAiReasoning({ model: "o3", max_tokens: 16384, temperature: 0.7, top_p: 0.9, stream: true });
    expect(out.max_tokens).toBeUndefined();
    expect(out.max_completion_tokens).toBe(16384);
    expect(out.temperature).toBeUndefined();
    expect(out.top_p).toBeUndefined();
    expect(out.stream).toBe(true);
  });

  it("max_tokens yoksa uydurmaz", () => {
    const out = adaptForOpenAiReasoning({ model: "o3", stream: true });
    expect("max_completion_tokens" in out).toBe(false);
  });
});
