/* Bağlam penceresi yönetimi (saf, test edilebilir).
   Kaba "eski mesajı at" yerine: yapıyı (tool_call eşleşmesi) BOZMADAN, eski
   ve büyük mesaj içeriklerini kırpar. Böylece token düşer, bağlam bütünlüğü
   korunur (ekstra AI çağrısı / özet maliyeti yok). */

export interface PrunableMessage {
  role: string;
  content: unknown;
  [key: string]: unknown;
}

/** Çağrı esnekliği için gevşek mesaj şekli (ChatMessage vb. uyumlu). */
type MsgLike = { role: string; content: unknown };

export interface PruneOptions {
  /** Son kaç mesaj olduğu gibi korunur (dokunulmaz). */
  keepRecent?: number;
  /** Eski mesajların içeriği bu karakter sınırını aşarsa kırpılır. */
  maxContentChars?: number;
}

/**
 * Eski ve uzun mesaj içeriklerini kırpar:
 * - 0. mesaj system ise korunur (talimatlar bozulmaz).
 * - Son `keepRecent` mesaj dokunulmaz.
 * - Aradaki mesajların string içeriği `maxContentChars`'ı aşarsa kısaltılır.
 * tool_call_id / tool_calls gibi alanlar korunur → API eşleşmesi bozulmaz.
 */
export function pruneMessages(messages: readonly MsgLike[], opts?: PruneOptions): PrunableMessage[] {
  const keepRecent = opts?.keepRecent ?? 6;
  const maxChars = opts?.maxContentChars ?? 3000;
  const cutoff = messages.length - keepRecent;
  return messages.map((m, i) => {
    const mm = m as PrunableMessage;
    if (i === 0 && mm.role === "system") return mm;
    if (i >= cutoff) return mm;
    if (typeof mm.content === "string" && mm.content.length > maxChars) {
      const trimmed = mm.content.slice(0, maxChars);
      return {
        ...mm,
        content: `${trimmed}\n\n[... ${mm.content.length - maxChars} karakter kısaltıldı (eski bağlam)]`,
      };
    }
    return mm;
  });
}

/** Mesaj dizisinin toplam string içerik uzunluğu (kabaca token tahmini için). */
export function totalContentChars(messages: readonly MsgLike[]): number {
  return messages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
}
