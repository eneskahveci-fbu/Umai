import type { ChatMessage } from "@/lib/types";

/**
 * Token limitine göre mesajları budar.
 * En eski mesajlardan başlayarak, sistem prompt'unu koruyarak keser.
 * Yaklaşık token hesaplaması: 1 token ≈ 4 karakter (İngilizce) veya ≈ 3 karakter (Türkçe).
 */
export function pruneMessages(
  messages: ChatMessage[],
  maxTokens: number,
): ChatMessage[] {
  if (messages.length === 0) return [];

  // Türkçe için karakter başına token oranı daha yüksek
  const charsPerToken = 3;
  const maxChars = maxTokens * charsPerToken;

  // Sistem mesajlarını koru
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  let totalChars = systemMessages.reduce(
    (sum, m) => sum + estimateChars(m),
    0,
  );

  const kept: ChatMessage[] = [];

  // Sondan başa doğru ekle (en yeni mesajlar öncelikli)
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msg = nonSystemMessages[i];
    const msgChars = estimateChars(msg);

    if (totalChars + msgChars <= maxChars) {
      kept.unshift(msg);
      totalChars += msgChars;
    } else {
      // İlk kullanıcı mesajını korumaya çalış
      if (i === 0 && kept.length === 0) {
        kept.unshift(msg);
      }
      break;
    }
  }

  return [...systemMessages, ...kept];
}

function estimateChars(msg: ChatMessage): number {
  let chars = msg.content?.length ?? 0;
  if (msg.tool_calls) {
    chars += JSON.stringify(msg.tool_calls).length;
  }
  if (msg.tool_call_id) {
    chars += msg.tool_call_id.length;
  }
  return chars;
}
