import type { ChatMessage } from "./types";

/* Mesaj dallandırma (Claude'daki edit & versions) — saf, test edilebilir.
   Bir kullanıcı mesajı düzenlenince eski sürüm + onun yanıt zinciri korunur;
   sürümler arasında gezilebilir. Her dal, o mesajdan SONRAKİ mesajların anlık
   görüntüsüdür. Dal meta'sı yalnızca düzenlenen (üst) mesajda tutulur. */

/* Akış/dallandırma yazımlarında hedef mesajı ROLE göre bulur — konuma göre
   DEĞİL. (Tem 2026: "modelin cevabı ben yazmışım gibi görünüyor" hatası.)

   Akış SÜRERKEN araya bir `role:"user"` mesajı girebiliyor (terminal/kod
   çıktısının ajana geri beslenmesi). Konumsal "son mesaj" o zaman yanlış
   mesajı gösteriyor. store.ts'teki tüm `*OnLast` yazıcıları bunu kullanıyor;
   dal birleştirme de kullanmalı — aksi halde dal meta'sı bir KULLANICI
   mesajına işlenir. Asistan yoksa -1. */
export function lastAssistantIndex(messages: readonly ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

function stripMeta(m: ChatMessage): ChatMessage {
  const copy = { ...m };
  delete copy.branches;
  delete copy.branchIndex;
  return copy;
}

/** Mesajı düzenler ve YENİ bir dal açar (eskisini koruyarak). Sonrasını keser. */
export function applyEditBranch(messages: ChatMessage[], index: number, newContent: string): ChatMessage[] {
  if (index < 0 || index >= messages.length) return messages;
  const head = messages.slice(0, index);
  const target = messages[index];
  const curIdx = target.branchIndex ?? 0;
  const branches = target.branches ? [...target.branches] : [messages.slice(index).map(stripMeta)];
  /* Mevcut görünümü aktif dala kaydet (düzenleme öncesi hali kaybolmasın). */
  branches[curIdx] = messages.slice(index).map(stripMeta);
  /* Yeni dal: sadece düzenlenmiş kullanıcı mesajı (yanıt sonra üretilecek). */
  branches.push([{ ...stripMeta(target), content: newContent }]);
  const newIndex = branches.length - 1;
  const newTarget: ChatMessage = { ...stripMeta(target), content: newContent, branches, branchIndex: newIndex };
  return [...head, newTarget];
}

/** Belirli bir dala geçer; mevcut zinciri aktif dala kaydedip seçileni geri yükler. */
export function applySwitchBranch(messages: ChatMessage[], index: number, bIdx: number): ChatMessage[] {
  const target = messages[index];
  if (!target?.branches || bIdx < 0 || bIdx >= target.branches.length || bIdx === (target.branchIndex ?? 0)) {
    return messages;
  }
  const head = messages.slice(0, index);
  const branches = [...target.branches];
  const curIdx = target.branchIndex ?? 0;
  branches[curIdx] = messages.slice(index).map(stripMeta); // mevcut zinciri sakla
  const selected = branches[bIdx];
  if (selected.length === 0) return messages;
  const first: ChatMessage = { ...stripMeta(selected[0]), branches, branchIndex: bIdx };
  return [...head, first, ...selected.slice(1).map(stripMeta)];
}

/* Asistan "Yeniden oluştur" dallanması — kullanıcı mesajı düzenlemesinden
   farklı olarak yeni içerik ANINDA bilinmiyor (normal akış/tool-loop akışıyla
   sonra üretiliyor). Bu yüzden ikiye bölünür: regenerate BAŞLAMADAN önce
   mevcut yanıtı bekleyen dal listesine aktar (stashAsPendingBranches), yeni
   yanıt TAMAMLANINCA bu listeyi son mesaja işle (mergeRegeneratedBranches). */

/** Son asistan mesajının (varsa önceki dal geçmişiyle) mevcut halini,
    regenerate öncesi "bekleyen dal listesi"ne çevirir. */
export function stashAsPendingBranches(message: ChatMessage): ChatMessage[][] {
  const branches = message.branches ? [...message.branches] : [[stripMeta(message)]];
  const curIdx = message.branchIndex ?? 0;
  branches[curIdx] = [stripMeta(message)];
  return branches;
}

/** Yeniden üretilen yanıt tamamlanınca çağrılır: bekleyen dalları + şimdi
    biten yeni son mesajı birleştirip dal meta'sını ona işler. */
export function mergeRegeneratedBranches(messages: ChatMessage[], pendingBranches: ChatMessage[][]): ChatMessage[] {
  if (messages.length === 0 || pendingBranches.length === 0) return messages;
  /* Konumsal `messages.length - 1` DEĞİL: yeni yanıt üretilirken araya gizli
     bir bağlam mesajı (terminal/kod çıktısı, role:"user") girmişse dal
     meta'sı o KULLANICI mesajına işleniyordu — sürüm okları yanlış balonda
     çıkar, asistanın dal geçmişi kaybolurdu. */
  const lastIdx = lastAssistantIndex(messages);
  if (lastIdx < 0) return messages;
  const target = messages[lastIdx];
  const branches = [...pendingBranches, [stripMeta(target)]];
  const newIndex = branches.length - 1;
  const newTarget: ChatMessage = { ...stripMeta(target), branches, branchIndex: newIndex };
  return [...messages.slice(0, lastIdx), newTarget, ...messages.slice(lastIdx + 1)];
}
