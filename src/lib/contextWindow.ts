import { DEFAULT_CONTEXT_WINDOW_TOKENS, MIN_CONTEXT_WINDOW_TOKENS, MAX_CONTEXT_WINDOW_TOKENS } from "./constants";

/**
 * Bir mesajın yaklaşık token sayısını tahmin eder.
 * Basit: karakter / 3.5 (İngilizce için ~4, kod için ~3).
 * Daha hassas olması gerekirse tiktoken kullanılabilir.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // Ortalama: İngilizce ~4 char/token, Türkçe ~3.5, kod ~3
  return Math.ceil(text.length / 3.5);
}

interface MessageLike {
  content: string;
  role?: string;
}

/**
 * Mesajları bağlam penceresine sığacak şekilde budar.
 * En eski mesajlardan başlayarak keser, sistem mesajını korur.
 * En az 2 mesajı her zaman tutar (sistem + son kullanıcı).
 */
export function pruneMessages(
  messages: MessageLike[],
  maxTokens: number = DEFAULT_CONTEXT_WINDOW_TOKENS,
): MessageLike[] {
  // Token limitini sınırla
  const limit = Math.max(
    MIN_CONTEXT_WINDOW_TOKENS,
    Math.min(maxTokens, MAX_CONTEXT_WINDOW_TOKENS),
  );

  if (messages.length === 0) return [];

  // Sistem mesajını ayır
  const systemMsg = messages[0]?.role === "system" ? messages[0] : null;
  const rest = systemMsg ? messages.slice(1) : messages;

  const systemTokens = systemMsg ? estimateTokens(systemMsg.content) : 0;
  let available = limit - systemTokens - 500; // 500 buffer for response

  if (available <= 0) {
    return systemMsg ? [systemMsg] : messages.slice(-1);
  }

  // En yeniden eskiye doğru ekle
  const kept: MessageLike[] = [];
  let used = 0;

  for (let i = rest.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(rest[i].content);
    if (used + tokens > available) break;
    kept.unshift(rest[i]);
    used += tokens;
  }

  // En az son mesajı tut
  if (kept.length === 0 && rest.length > 0) {
    kept.push(rest[rest.length - 1]);
  }

  if (systemMsg) kept.unshift(systemMsg);
  return kept;
}

/**
 * Toplam token tahminini döndürür (debug için).
 */
export function countTokens(messages: MessageLike[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}
