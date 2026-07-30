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

const GROQ = "https://api.groq.com/openai/v1";

describe("providerHealth", () => {
  it("is not down before any failure is recorded", () => {
    expect(isProviderDown("groq", GROQ, "llama-3.3-70b")).toBe(false);
  });

  it("marks a candidate down after a failure, and back up after success", () => {
    markProviderDown("groq", GROQ, "llama-3.3-70b");
    expect(isProviderDown("groq", GROQ, "llama-3.3-70b")).toBe(true);
    markProviderUp("groq", GROQ, "llama-3.3-70b");
    expect(isProviderDown("groq", GROQ, "llama-3.3-70b")).toBe(false);
  });

  it("is case-insensitive and scoped per provider+baseUrl pair", () => {
    markProviderDown("groq", "https://API.GROQ.COM/openai/v1", "llama-3.3-70b");
    expect(isProviderDown("groq", GROQ, "llama-3.3-70b")).toBe(true);
    expect(isProviderDown("cerebras", GROQ, "llama-3.3-70b")).toBe(false);
  });

  /* H6 — "aktif model bazen hiç cevap vermiyor". Anahtar MODELİ içermediği
     için openrouter.ai gibi çok modelli bir base URL'de herhangi bir modelin
     tek bir 429'u, kullanıcının seçtiği model dahil TÜM modelleri 15sn-5dk
     boyunca "down" yapıyordu. */
  it("aynı base URL'deki FARKLI modeller birbirini down yapmaz", () => {
    const OR = "https://openrouter.ai/api/v1";
    markProviderDown("openrouter", OR, "some/rate-limited-model");
    expect(isProviderDown("openrouter", OR, "some/rate-limited-model")).toBe(true);
    expect(isProviderDown("openrouter", OR, "anthropic/claude")).toBe(false);
  });

  it("sağlıksız adayı ELEMEZ, yalnız SONA alır", () => {
    const candidates = [
      { provider: "groq", baseUrl: "https://groq.example", model: "a" },
      { provider: "cerebras", baseUrl: "https://cerebras.example", model: "b" },
    ];
    markProviderDown("groq", "https://groq.example", "a");
    const ordered = prioritizeHealthyCandidates(candidates);
    expect(ordered).toEqual([candidates[1], candidates[0]]);
    expect(ordered).toHaveLength(candidates.length);
  });

  /* Eleme, /api/chat'teki dürüstlük kapısını (`c === primary`) da kırıyordu:
     birincil aday listeden çıkarıldığı için 400/404/410 gibi "bu model yanlış/
     kaldırılmış" hataları hiç yüzeye çıkamıyor, sessizce başka bir modele
     geçiliyordu. Birincil aday HER ZAMAN listede kalmalı. */
  it("birincil aday sağlıksız olsa bile listede kalır", () => {
    const primary = { provider: "groq", baseUrl: "https://groq.example", model: "a" };
    const candidates = [primary, { provider: "cerebras", baseUrl: "https://cerebras.example", model: "b" }];
    markProviderDown(primary.provider, primary.baseUrl, primary.model);
    expect(prioritizeHealthyCandidates(candidates)).toContain(primary);
  });

  it("hepsi sağlıksızsa sıra ve içerik korunur", () => {
    const candidates = [
      { provider: "groq", baseUrl: "https://groq.example", model: "a" },
      { provider: "cerebras", baseUrl: "https://cerebras.example", model: "b" },
    ];
    markProviderDown("groq", "https://groq.example", "a");
    markProviderDown("cerebras", "https://cerebras.example", "b");
    expect(prioritizeHealthyCandidates(candidates)).toEqual(candidates);
  });

  it("hepsi sağlıklıysa orijinal sıra korunur (kararlı sıralama)", () => {
    const candidates = [
      { provider: "groq", baseUrl: "https://groq.example", model: "a" },
      { provider: "cerebras", baseUrl: "https://cerebras.example", model: "b" },
    ];
    expect(prioritizeHealthyCandidates(candidates)).toEqual(candidates);
  });

  it("expands the cooldown on repeated failures, capped at 5 minutes", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    markProviderDown("groq", "https://groq.example", "a"); // 15s
    markProviderDown("groq", "https://groq.example", "a"); // 30s
    markProviderDown("groq", "https://groq.example", "a"); // 60s
    vi.setSystemTime(now + 61_000);
    expect(isProviderDown("groq", "https://groq.example", "a")).toBe(false);

    __resetProviderHealthForTests();
    for (let i = 0; i < 20; i++) markProviderDown("groq", "https://groq.example", "a");
    vi.setSystemTime(now + 61_000 + 4 * 60_000); // 4 more minutes
    expect(isProviderDown("groq", "https://groq.example", "a")).toBe(true); // still within 5min cap
    vi.setSystemTime(now + 61_000 + 6 * 60_000); // past the 5min cap
    expect(isProviderDown("groq", "https://groq.example", "a")).toBe(false);
    vi.useRealTimers();
  });
});
