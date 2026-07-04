import { describe, expect, it } from "vitest";
import { splitReasoning } from "../reasoning";

describe("splitReasoning", () => {
  it("düz metni olduğu gibi bırakır", () => {
    const r = splitReasoning("1 USD ≈ 32 TRY.");
    expect(r.content).toBe("1 USD ≈ 32 TRY.");
    expect(r.thinking).toBe("");
  });

  it("<think> bloğunu ayırır", () => {
    const r = splitReasoning("<think>kuru hesaplamalıyım</think>Sonuç: 32 TRY");
    expect(r.content).toBe("Sonuç: 32 TRY");
    expect(r.thinking).toBe("kuru hesaplamalıyım");
  });

  it("<thinking> ve <reasoning> etiketlerini de ayırır", () => {
    const r = splitReasoning("<reasoning>adım1</reasoning>Cevap<thinking>not</thinking>");
    expect(r.content).toBe("Cevap");
    expect(r.thinking).toContain("adım1");
    expect(r.thinking).toContain("not");
  });

  it("harmony kanallarını ayırır (analysis→düşünce, final→içerik)", () => {
    const raw = "<|channel|>analysis<|message|>We need web search. Ok.<|end|><|start|>assistant<|channel|>final<|message|>1 dolar ≈ 32 TL.";
    const r = splitReasoning(raw);
    expect(r.content).toBe("1 dolar ≈ 32 TL.");
    expect(r.thinking).toContain("We need web search");
    expect(r.content).not.toContain("<|");
  });

  it("assistantfinal ayracından sonrasını içerik alır", () => {
    const r = splitReasoning("analysis: they want the rate. assistantfinal 1 USD = 32 TRY");
    expect(r.content).toBe("1 USD = 32 TRY");
    expect(r.thinking).toContain("they want the rate");
  });

  it("artık kontrol token'larını temizler", () => {
    const r = splitReasoning("<|start|>Merhaba<|end|>");
    expect(r.content).toBe("Merhaba");
  });
});
