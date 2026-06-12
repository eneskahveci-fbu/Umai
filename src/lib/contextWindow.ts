// ── Bağlam penceresi yönetimi (token-aware mesaj budama) ──

import type { ChatMessage } from "./types";

/**
 * Basit token tahmini: her ~4 karakter ≈ 1 token.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Mesajları en son mesajdan geriye doğru budar;
 * sistem prompt'unu korur, toplam token sınırını aşmaz.
 */
export function pruneMessages(
  messages: (ChatMessage | { role: string; content: unknown })[],
  systemPrompt: string,
  maxTokens = 128_000,
  reserveForResponse = 4096,
): (ChatMessage | { role: string; content: unknown })[] {
  const budget = maxTokens - reserveForResponse;
  const sysTokens = estimateTokens(systemPrompt);

  // Sistem mesajı zaten ayrı yollanır, burada varsa onu da sayalım
  let used = sysTokens;

  const result: (ChatMessage | { role: string; content: unknown })[] = [];
  const systemMessages: typeof result = [];

  // Sistem mesajlarını ayır
  for (const m of messages) {
    if (m.role === "system") {
      systemMessages.push(m);
      used += estimateTokens(String(m.content));
    }
  }

  // Son mesajlardan geriye doğru ekle
  const nonSystem = messages.filter((m) => m.role !== "system");
  const reversed = [...nonSystem].reverse();

  for (const m of reversed) {
    const tokenEstimate = estimateTokens(String(m.content));
    if (used + tokenEstimate > budget) break;
    used += tokenEstimate;
    result.unshift(m);
  }

  // En az son kullanıcı mesajını koru
  if (result.length === 0 && nonSystem.length > 0) {
    const last = nonSystem[nonSystem.length - 1];
    result.push(last);
  }

  return [...systemMessages, ...result];
}

/**
 * Son N mesajı al (son user + assistant çiftlerini koruyarak).
 */
export function lastNMessages(
  messages: (ChatMessage | { role: string; content: unknown })[],
  n: number,
): typeof messages {
  return messages.slice(-n);
}
