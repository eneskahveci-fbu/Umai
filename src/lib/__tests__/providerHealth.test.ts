import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  isProviderDown,
  markProviderDown,
  markProviderUp,
  prioritizeHealthyCandidates,
  __resetProviderHealthForTests,
} from "../providerHealth";

beforeEach(() => {
  __resetProviderHealthForTests();
  vi.useRealTimers();
});

describe("providerHealth", () => {
  it("is not down before any failure is recorded", () => {
    expect(isProviderDown("groq", "https://api.groq.com/openai/v1")).toBe(false);
  });

  it("marks a candidate down after a failure, and back up after success", () => {
    markProviderDown("groq", "https://api.groq.com/openai/v1");
    expect(isProviderDown("groq", "https://api.groq.com/openai/v1")).toBe(true);
    markProviderUp("groq", "https://api.groq.com/openai/v1");
    expect(isProviderDown("groq", "https://api.groq.com/openai/v1")).toBe(false);
  });

  it("is case-insensitive and scoped per provider+baseUrl pair", () => {
    markProviderDown("groq", "https://API.GROQ.COM/openai/v1");
    expect(isProviderDown("groq", "https://api.groq.com/openai/v1")).toBe(true);
    expect(isProviderDown("cerebras", "https://api.groq.com/openai/v1")).toBe(false);
  });

  it("prioritizeHealthyCandidates filters out down candidates but keeps healthy ones first", () => {
    const candidates = [
      { provider: "groq", baseUrl: "https://groq.example" },
      { provider: "cerebras", baseUrl: "https://cerebras.example" },
    ];
    markProviderDown("groq", "https://groq.example");
    const ordered = prioritizeHealthyCandidates(candidates);
    expect(ordered).toEqual([{ provider: "cerebras", baseUrl: "https://cerebras.example" }]);
  });

  it("never returns an empty list — falls back to the full candidate list when all are down", () => {
    const candidates = [
      { provider: "groq", baseUrl: "https://groq.example" },
      { provider: "cerebras", baseUrl: "https://cerebras.example" },
    ];
    markProviderDown("groq", "https://groq.example");
    markProviderDown("cerebras", "https://cerebras.example");
    const ordered = prioritizeHealthyCandidates(candidates);
    expect(ordered).toEqual(candidates);
  });

  it("expands the cooldown on repeated failures, capped at 5 minutes", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    markProviderDown("groq", "https://groq.example"); // 15s
    markProviderDown("groq", "https://groq.example"); // 30s
    markProviderDown("groq", "https://groq.example"); // 60s
    vi.setSystemTime(now + 61_000);
    expect(isProviderDown("groq", "https://groq.example")).toBe(false);

    __resetProviderHealthForTests();
    for (let i = 0; i < 20; i++) markProviderDown("groq", "https://groq.example");
    vi.setSystemTime(now + 61_000 + 4 * 60_000); // 4 more minutes
    expect(isProviderDown("groq", "https://groq.example")).toBe(true); // still within 5min cap
    vi.setSystemTime(now + 61_000 + 6 * 60_000); // past the 5min cap
    expect(isProviderDown("groq", "https://groq.example")).toBe(false);
    vi.useRealTimers();
  });
});
