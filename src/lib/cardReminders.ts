/* Kartlar (Anki) hatırlatma push bildirimi — saf karar mantığı. I/O (Supabase
   sorgusu, push gönderimi) `/api/cron/cards-reminder/route.ts`'te; bu dosya
   yalnız "kime bildirim gitmeli" sorusuna saf, test edilebilir bir cevap verir. */
import type { CraftDeck } from "./types";
import { dueCards } from "./cards";

export interface UserConfigRow {
  user_id: string;
  config: unknown;
}

export interface ReminderTarget {
  userId: string;
  dueCount: number;
}

/** Hangi kullanıcılara "kartların vadesi geldi" bildirimi gitmeli.
    `sentToday`: bugün zaten bildirim gönderilmiş kullanıcı id'leri — cron
    yanlışlıkla birden fazla kez tetiklenirse bile aynı gün tekrar spam
    gitmesin diye. */
export function usersNeedingCardReminder(
  rows: UserConfigRow[],
  sentToday: Set<string>,
  now = Date.now(),
): ReminderTarget[] {
  const targets: ReminderTarget[] = [];
  for (const row of rows) {
    if (sentToday.has(row.user_id)) continue;
    const cfg = row.config;
    if (!cfg || typeof cfg !== "object") continue;
    const decks = (cfg as { craftDecks?: unknown }).craftDecks;
    if (!Array.isArray(decks)) continue;
    const allCards = (decks as CraftDeck[]).flatMap((d) => (d && Array.isArray(d.cards) ? d.cards : []));
    const due = dueCards(allCards, now);
    if (due.length > 0) targets.push({ userId: row.user_id, dueCount: due.length });
  }
  return targets;
}

/** Bildirim başlığı/gövdesi — tekil/çoğul metni doğru çeker. */
export function cardReminderMessage(dueCount: number): { title: string; body: string } {
  return {
    title: "Kartların seni bekliyor",
    body: dueCount === 1 ? "1 kart tekrar zamanı geldi." : `${dueCount} kart tekrar zamanı geldi.`,
  };
}
