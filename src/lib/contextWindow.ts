// src/lib/contextWindow.ts — Token sayımı ve bağlam penceresi yönetimi

import { DEFAULT_CONTEXT_WINDOW } from "./constants";

/**
 * Basit token tahmini (char / 4 kuralı, İngilizce için ~%85 doğruluk).
 * Gerçek token sayımı için tiktoken veya gpt-tokenizer kullanılmalı.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Türkçe karakterler için biraz daha geniş hesapla
  return Math.ceil(text.length / 3.5);
}

/**
 * Mesaj dizisindeki toplam token sayısını tahmin et.
 */
export function estimateMessageTokens(
  messages: Array<{ content: string; role?: string }>,
): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.role ?? "user");
    total += estimateTokens(msg.content);
    total += 4; // mesaj sınırlayıcıları için sabit
  }
  return total;
}

/**
 * Belirli bir max token değerine sığacak şekilde mesajları buda.
 * En son mesajlar korunur, en eskiler atılır.
 */
export function pruneMessages<T extends { content: string; role?: string }>(
  messages: T[],
  maxTokens: number = DEFAULT_CONTEXT_WINDOW,
  systemPromptTokens: number = 0,
): T[] {
  const available = maxTokens - systemPromptTokens - 500; // yanıt için buffer
  if (available <= 0) return messages.slice(-2); // son 2 mesajı koru

  const pruned: T[] = [];
  let tokenCount = 0;

  // Sondan başa doğru ekle
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content) + estimateTokens(msg.role ?? "user") + 4;

    if (tokenCount + msgTokens > available) break;

    pruned.unshift(msg);
    tokenCount += msgTokens;
  }

  return pruned;
}

/**
 * Toplam context'in yüzde kaçı dolu?
 */
export function contextUsagePercent(
  usedTokens: number,
  totalWindow: number = DEFAULT_CONTEXT_WINDOW,
): number {
  return Math.min(100, Math.round((usedTokens / totalWindow) * 100));
}
