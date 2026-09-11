import { describe, expect, it } from "vitest";
import { updateStat, orderByReliability, applyOrchestration } from "../orchestrator";
import type { FallbackCandidate } from "../fallback";
import type { Provider } from "../types";

const cand = (provider: Provider): FallbackCandidate => ({ provider, baseUrl: "https://x", model: "m", apiKey: "k" });

describe("updateStat (EMA)", () => {
  it("başarı yükseltir, başarısızlık düşürür, örnek sayar", () => {
    const s1 = updateStat(undefined, true, 1);
    expect(s1.score).toBeGreaterThan(0.7);
    expect(s1.samples).toBe(1);
    const s2 = updateStat(s1, false, 2);
    expect(s2.score).toBeLessThan(s1.score);
    expect(s2.samples).toBe(2);
  });
  it("skor [0,1] aralığında kalır", () => {
    let s = updateStat(undefined, false, 0);
    for (let i = 0; i < 20; i++) s = updateStat(s, false, i);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(1);
  });
});

describe("orderByReliability", () => {
  it("yüksek skoru öne, düşüğü sona alır", () => {
    const cands = [cand("groq"), cand("gemini"), cand("pollinations")];
    const stats = {
      pollinations: { score: 0.95, updatedAt: 1, samples: 5 },
      groq: { score: 0.1, updatedAt: 1, samples: 5 },
    };
    const out = orderByReliability(cands, stats);
    expect(out[0].provider).toBe("pollinations");
    expect(out[out.length - 1].provider).toBe("groq");
  });
  it("istatistik yoksa orijinal sırayı korur (güvenli no-op)", () => {
    const cands = [cand("groq"), cand("gemini"), cand("cerebras")];
    expect(orderByReliability(cands, {}).map((c) => c.provider)).toEqual(["groq", "gemini", "cerebras"]);
  });
});

describe("applyOrchestration — drop-in güvenliği", () => {
  const chain = [cand("gemini"), cand("groq"), cand("pollinations")];
  it("enabled falsy -> girdiyi değiştirmeden döner (undefined de dahil)", () => {
    expect(applyOrchestration(chain, false)).toEqual(chain);
    expect(applyOrchestration(chain)).toEqual(chain);
  });
  it("enabled true ama istatistik yok -> yine aynı sıra (no-op)", () => {
    expect(applyOrchestration(chain, true).map((c) => c.provider)).toEqual(chain.map((c) => c.provider));
  });
});
