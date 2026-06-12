import type { ChatMessage } from "./types";

/* Mesaj dallandırma (Claude'daki edit & versions) — saf, test edilebilir.
   Bir kullanıcı mesajı düzenlenince eski sürüm + onun yanıt zinciri korunur;
   sürümler arasında gezilebilir. Her dal, o mesajdan SONRAKİ mesajların anlık
   görüntüsüdür. Dal meta'sı yalnızca düzenlenen (üst) mesajda tutulur. */

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
