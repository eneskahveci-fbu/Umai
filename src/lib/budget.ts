/* Harcama/kullanım bütçe uyarısı — kullanıcının belirlediği aylık USD
 * bütçesine göre, AnalyticsSettings'in ZATEN hesapladığı yaklaşık maliyet
 * mantığının (aktif modelin fiyatı × tüm token'lar) ay-kapsamlı hali. Saf,
 * sunucu/ek maliyet yok — tamamen istemcideki `chats`'ten hesaplanır. */
import type { Chat } from "./types";
import { calculateCost } from "./pricing";

export type BudgetLevel = "ok" | "warning" | "over";

export interface BudgetStatus {
  spentUsd: number;
  budgetUsd: number;
  ratio: number;
  level: BudgetLevel;
}

/** İçinde bulunulan takvim ayının [başlangıç, bitiş) epoch ms aralığı. */
export function currentMonthRange(now = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end };
}

/** Bütçe belirlenmemiş/geçersizse null döner (özellik sessizce kapalı kalır).
    `chats.created_at`'e göre aya atanır — AnalyticsSettings'in "son 7 gün"
    kovalamasıyla AYNI yaklaşım/kısıtla tutarlı (mesaj-bazlı zaman damgası
    tutulmuyor, sohbetin oluşturulma anı kullanılıyor). */
export function calcBudgetStatus(
  chats: Chat[],
  activeModel: string | undefined,
  budgetUsd: number | undefined,
  now = Date.now(),
): BudgetStatus | null {
  if (!budgetUsd || budgetUsd <= 0 || !activeModel) return null;
  const { start, end } = currentMonthRange(now);
  let tin = 0, tout = 0;
  for (const c of chats) {
    if (c.incognito) continue;
    if (c.created_at < start || c.created_at >= end) continue;
    tin += c.totalInTokens ?? 0;
    tout += c.totalOutTokens ?? 0;
  }
  const spentUsd = calculateCost(activeModel, tin, tout) ?? 0;
  const ratio = spentUsd / budgetUsd;
  const level: BudgetLevel = ratio >= 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
  return { spentUsd, budgetUsd, ratio, level };
}
