import { describe, expect, it } from "vitest";
import { computeFitness, updateFitness, type FitnessRecord } from "../evolutionaryRouter";

const base: FitnessRecord = {
  provider: "gemini",
  model: "gemini-2.5-pro",
  successRate: 0.7,
  speedScore: 0.7,
  tokenEfficiency: 0.7,
  taskSamples: {},
  updatedAt: 0,
  samples: 0,
};

describe("computeFitness", () => {
  it("üç boyutun çarpımıdır", () => {
    expect(computeFitness({ ...base, successRate: 1, speedScore: 1, tokenEfficiency: 1 })).toBe(1);
    expect(computeFitness({ ...base, successRate: 0.5, speedScore: 0.5, tokenEfficiency: 0.5 })).toBeCloseTo(0.125);
  });

  it("tek boyut sıfırsa tüm skoru sıfırlar (doğal ayıklanma)", () => {
    expect(computeFitness({ ...base, successRate: 0, speedScore: 1, tokenEfficiency: 1 })).toBe(0);
  });
});

describe("updateFitness (EMA)", () => {
  it("başarılı hızlı istek successRate ve speedScore'u yükseltir", () => {
    const r = updateFitness(undefined, "gemini", "gemini-2.5-pro", 500, 100, 80, true, "code");
    expect(r.successRate).toBeGreaterThan(0.7);
    expect(r.speedScore).toBeGreaterThan(0.7);
    expect(r.samples).toBe(1);
    expect(r.taskSamples.code).toBe(1);
  });

  it("başarısız istek successRate'i düşürür", () => {
    const r = updateFitness(base, "gemini", "gemini-2.5-pro", 500, 100, 80, false, "code");
    expect(r.successRate).toBeLessThan(base.successRate);
  });

  it("yüksek gecikme speedScore'u düşürür", () => {
    const fast = updateFitness(base, "gemini", "gemini-2.5-pro", 100, 100, 80, true, "code");
    const slow = updateFitness(base, "gemini", "gemini-2.5-pro", 20000, 100, 80, true, "code");
    expect(slow.speedScore).toBeLessThan(fast.speedScore);
  });

  it("tüm boyutlar [0,1] aralığında kalır", () => {
    let r: FitnessRecord | undefined = base;
    for (let i = 0; i < 30; i++) r = updateFitness(r, "groq", "m", 50000, 0, 1000, i % 2 === 0, "other");
    expect(r.successRate).toBeGreaterThanOrEqual(0);
    expect(r.successRate).toBeLessThanOrEqual(1);
    expect(r.speedScore).toBeGreaterThanOrEqual(0);
    expect(r.tokenEfficiency).toBeGreaterThanOrEqual(0);
    expect(r.tokenEfficiency).toBeLessThanOrEqual(1);
  });

  it("görev kategorisi bazlı örnek sayısını ayrı ayrı biriktirir", () => {
    let r = updateFitness(undefined, "gemini", "m", 500, 100, 50, true, "code");
    r = updateFitness(r, "gemini", "m", 500, 100, 50, true, "doc");
    r = updateFitness(r, "gemini", "m", 500, 100, 50, true, "code");
    expect(r.taskSamples.code).toBe(2);
    expect(r.taskSamples.doc).toBe(1);
    expect(r.samples).toBe(3);
  });
});
