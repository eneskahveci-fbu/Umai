import { describe, it, expect } from "vitest";
import { calcBudgetStatus, currentMonthRange } from "../budget";
import type { Chat } from "../types";

const NOW = new Date(2026, 6, 16, 12, 0, 0).getTime(); // 16 Temmuz 2026

function chat(over: Partial<Chat> = {}): Chat {
  return {
    id: "c1", title: "T", messages: [], created_at: NOW,
    totalInTokens: 0, totalOutTokens: 0,
    ...over,
  } as Chat;
}

describe("currentMonthRange", () => {
  it("ayın ilk ve bir sonraki ayın ilk anını döner", () => {
    const { start, end } = currentMonthRange(NOW);
    expect(new Date(start).getDate()).toBe(1);
    expect(new Date(start).getMonth()).toBe(6);
    expect(new Date(end).getMonth()).toBe(7);
  });
});

describe("calcBudgetStatus", () => {
  it("bütçe belirtilmemişse/0/negatifse null döner", () => {
    expect(calcBudgetStatus([chat()], "gpt-4o-mini", undefined, NOW)).toBeNull();
    expect(calcBudgetStatus([chat()], "gpt-4o-mini", 0, NOW)).toBeNull();
    expect(calcBudgetStatus([chat()], "gpt-4o-mini", -5, NOW)).toBeNull();
  });

  it("aktif model yoksa null döner", () => {
    expect(calcBudgetStatus([chat()], undefined, 10, NOW)).toBeNull();
  });

  it("gizli (incognito) sohbetleri ve bu ay dışındaki sohbetleri saymaz", () => {
    const lastMonth = new Date(2026, 5, 15).getTime();
    const chats = [
      chat({ id: "a", totalInTokens: 1_000_000, totalOutTokens: 1_000_000, incognito: true }),
      chat({ id: "b", totalInTokens: 1_000_000, totalOutTokens: 1_000_000, created_at: lastMonth }),
      chat({ id: "c", totalInTokens: 100_000, totalOutTokens: 100_000 }),
    ];
    const status = calcBudgetStatus(chats, "gpt-4o-mini", 100, NOW)!;
    // yalnız "c": 100k girdi (0.15$/M) + 100k çıktı (0.60$/M)
    expect(status.spentUsd).toBeCloseTo(0.015 + 0.06, 5);
  });

  it("seviyeyi doğru sınıflandırır: ok / warning (>=%80) / over (>=%100)", () => {
    const okChats = [chat({ totalInTokens: 100_000, totalOutTokens: 0 })];
    expect(calcBudgetStatus(okChats, "gpt-4o-mini", 100, NOW)!.level).toBe("ok");

    // %80'in üzerine denk gelecek şekilde ayarlanmış bir bütçe (kesirli float
    // sınır hatasından kaçınmak için tam %80 yerine biraz üstü kullanıldı)
    const c = chat({ totalInTokens: 0, totalOutTokens: 1_000_000 }); // 0.60$ (gpt-4o-mini çıktı fiyatı)
    const warn = calcBudgetStatus([c], "gpt-4o-mini", 0.7, NOW)!; // 0.60/0.7 ≈ %85.7
    expect(warn.level).toBe("warning");

    const over = calcBudgetStatus([c], "gpt-4o-mini", 0.5, NOW)!; // 0.60/0.5 = %120
    expect(over.level).toBe("over");
  });

  it("fiyatı bilinmeyen modelde harcama 0 sayılır (ok kalır)", () => {
    const status = calcBudgetStatus([chat({ totalInTokens: 1_000_000, totalOutTokens: 1_000_000 })], "bilinmeyen-model-xyz", 10, NOW)!;
    expect(status.spentUsd).toBe(0);
    expect(status.level).toBe("ok");
  });
});
