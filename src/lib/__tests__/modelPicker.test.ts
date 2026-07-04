import { describe, expect, it } from "vitest";
import { pickReplacementModel } from "../modelPicker";

describe("pickReplacementModel", () => {
  it("boş liste → no-safe-match, firstAvailable null", () => {
    expect(pickReplacementModel([], ["a", "b"])).toEqual({ kind: "no-safe-match", firstAvailable: null });
  });

  it("hardcoded (preferred) eşleşme varsa onu seçer", () => {
    const r = pickReplacementModel(
      ["zeta/foo", "deepseek/deepseek-chat-v3-0324:free", "alpha/bar"],
      ["deepseek/deepseek-chat-v3-0324:free", "qwen/qwen3-coder:free"],
    );
    expect(r).toEqual({ kind: "hardcoded-match", model: "deepseek/deepseek-chat-v3-0324:free" });
  });

  it("preferredList sırasına göre İLK eşleşen hardcoded modeli seçer (liveList sırasına göre değil)", () => {
    const r = pickReplacementModel(
      ["qwen/qwen3-coder:free", "deepseek/deepseek-chat-v3-0324:free"],
      ["deepseek/deepseek-chat-v3-0324:free", "qwen/qwen3-coder:free"],
    );
    expect(r).toEqual({ kind: "hardcoded-match", model: "deepseek/deepseek-chat-v3-0324:free" });
  });

  it("hardcoded eşleşme yok, orijinal model :free niyetli ve listede :free varsa → free-tier-match", () => {
    const r = pickReplacementModel(
      ["openai/gpt-4o-mini", "meta-llama/llama-4-maverick:free", "anthropic/claude-3-haiku"],
      ["deepseek/deepseek-chat-v3-0324:free"],
      "deepseek/deepseek-r1-0528:free",
    );
    expect(r).toEqual({ kind: "free-tier-match", model: "meta-llama/llama-4-maverick:free" });
  });

  it("hardcoded eşleşme yok, orijinal model :free DEĞİLSE → free-tier-match aranmaz, no-safe-match", () => {
    const r = pickReplacementModel(
      ["openai/gpt-4o-mini", "meta-llama/llama-4-maverick:free"],
      ["deepseek/deepseek-chat-v3-0324:free"],
      "openai/gpt-4o", // free değil
    );
    expect(r).toEqual({ kind: "no-safe-match", firstAvailable: "openai/gpt-4o-mini" });
  });

  it("hardcoded eşleşme yok, :free niyeti var ama listede hiç :free yok → no-safe-match, ilk elemana düşer", () => {
    const r = pickReplacementModel(
      ["openai/gpt-4o-mini", "anthropic/claude-3-haiku"],
      ["deepseek/deepseek-chat-v3-0324:free"],
      "deepseek/deepseek-r1-0528:free",
    );
    expect(r).toEqual({ kind: "no-safe-match", firstAvailable: "openai/gpt-4o-mini" });
  });

  it("originalModel hiç verilmemişse (undefined) free niyeti aranmaz → no-safe-match", () => {
    const r = pickReplacementModel(
      ["some/model:free", "other/model"],
      ["nonexistent/model"],
    );
    expect(r).toEqual({ kind: "no-safe-match", firstAvailable: "some/model:free" });
  });

  it("çoklu :free eşleşmede liveList sırasına göre İLKİ seçilir (belirleyici)", () => {
    const r = pickReplacementModel(
      ["b/model:free", "a/model:free"],
      [],
      "x/model:free",
    );
    expect(r).toEqual({ kind: "free-tier-match", model: "b/model:free" });
  });
});
