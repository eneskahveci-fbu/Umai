import { describe, expect, it } from "vitest";
import { cardReminderMessage, usersNeedingCardReminder, type UserConfigRow } from "../cardReminders";
import type { CraftDeck } from "../types";

const NOW = 1_700_000_000_000;

function deck(cards: { due: number }[]): CraftDeck {
  return {
    id: "d1", title: "Deste", createdAt: NOW, updatedAt: NOW,
    cards: cards.map((c, i) => ({ id: `c${i}`, front: "ön", back: "arka", box: 0, due: c.due })),
  };
}

describe("usersNeedingCardReminder", () => {
  it("vadesi gelmiş kartı olan kullanıcıyı hedefe ekler", () => {
    const rows: UserConfigRow[] = [
      { user_id: "u1", config: { craftDecks: [deck([{ due: NOW - 1000 }, { due: NOW + 1000 }])] } },
    ];
    const targets = usersNeedingCardReminder(rows, new Set(), NOW);
    expect(targets).toEqual([{ userId: "u1", dueCount: 1 }]);
  });

  it("hiç vadesi gelmiş kart yoksa hedefe eklemez", () => {
    const rows: UserConfigRow[] = [
      { user_id: "u1", config: { craftDecks: [deck([{ due: NOW + 1000 }])] } },
    ];
    expect(usersNeedingCardReminder(rows, new Set(), NOW)).toEqual([]);
  });

  it("craftDecks yoksa/boşsa sessizce atlar", () => {
    const rows: UserConfigRow[] = [
      { user_id: "u1", config: {} },
      { user_id: "u2", config: { craftDecks: [] } },
      { user_id: "u3", config: null },
      { user_id: "u4", config: "not-an-object" },
    ];
    expect(usersNeedingCardReminder(rows, new Set(), NOW)).toEqual([]);
  });

  it("bugün zaten bildirim gönderilmiş kullanıcıyı atlar (dedup)", () => {
    const rows: UserConfigRow[] = [
      { user_id: "u1", config: { craftDecks: [deck([{ due: NOW - 1000 }])] } },
    ];
    expect(usersNeedingCardReminder(rows, new Set(["u1"]), NOW)).toEqual([]);
  });

  it("birden fazla kullanıcıyı doğru şekilde ayırt eder", () => {
    const rows: UserConfigRow[] = [
      { user_id: "u1", config: { craftDecks: [deck([{ due: NOW - 1000 }])] } },
      { user_id: "u2", config: { craftDecks: [deck([{ due: NOW + 1000 }])] } },
      { user_id: "u3", config: { craftDecks: [deck([{ due: NOW - 1 }, { due: NOW - 2 }])] } },
    ];
    const targets = usersNeedingCardReminder(rows, new Set(), NOW);
    expect(targets).toEqual([{ userId: "u1", dueCount: 1 }, { userId: "u3", dueCount: 2 }]);
  });
});

describe("cardReminderMessage", () => {
  it("tekil için doğru metni döner", () => {
    expect(cardReminderMessage(1).body).toBe("1 kart tekrar zamanı geldi.");
  });

  it("çoğul için doğru metni döner", () => {
    expect(cardReminderMessage(3).body).toBe("3 kart tekrar zamanı geldi.");
  });

  it("başlık her zaman sabit", () => {
    expect(cardReminderMessage(5).title).toBe("Kartların seni bekliyor");
  });
});
