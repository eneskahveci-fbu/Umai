import { describe, expect, it } from "vitest";
import { modelQualityRank, sortByQuality, MODEL_QUALITY_ORDER } from "../modelQuality";

describe("modelQualityRank", () => {
  it("bilinen modelleri listedeki konumuna göre sıralar (küçük = daha güçlü)", () => {
    expect(modelQualityRank("gpt-4o", "GPT-4o")).toBeLessThan(modelQualityRank("gemini-2.5-flash", "Gemini 2.5 Flash"));
    expect(modelQualityRank("claude-opus-4", "Opus")).toBeLessThan(modelQualityRank("gpt-4o", "GPT-4o"));
  });

  it("tanınmayan modeller Infinity döner (listenin sonuna düşer)", () => {
    expect(modelQualityRank("acme-mystery-model", "Mystery")).toBe(Infinity);
  });

  it("model adında geçmese bile label'da geçen anahtar kelimeyi yakalar", () => {
    expect(modelQualityRank("some-internal-id", "Claude Opus 4.5")).toBeLessThan(Infinity);
  });

  it("MODEL_QUALITY_ORDER'daki her giriş kendi indeksini döner", () => {
    MODEL_QUALITY_ORDER.forEach((key, i) => {
      expect(modelQualityRank(key, "")).toBe(i);
    });
  });
});

describe("sortByQuality", () => {
  it("en güçlüden en zayıfa sıralar", () => {
    const models = [
      { model: "gemini-2.5-flash", label: "Gemini Flash" },
      { model: "gpt-4o", label: "GPT-4o" },
      { model: "claude-opus-4", label: "Opus" },
    ];
    expect(sortByQuality(models).map((m) => m.model)).toEqual(["claude-opus-4", "gpt-4o", "gemini-2.5-flash"]);
  });

  it("eşit sırada (ikisi de tanınmıyor) göreli sırayı korur (kararlı sort)", () => {
    const models = [
      { model: "acme-a", label: "" },
      { model: "acme-b", label: "" },
    ];
    expect(sortByQuality(models).map((m) => m.model)).toEqual(["acme-a", "acme-b"]);
  });
});
