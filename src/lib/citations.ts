/* Defter (NotebookStudio) atıf ayrıştırma — sohbet yanıtındaki "[1]", "[2]"
   gibi köşeli-parantez atıflarını tıklanabilir kaynak referanslarına çevirmek
   için saf ayrıştırma. Numaralandırma, buildNotebookSystem'in ürettiğiyle
   AYNI sırayı (yalnız etkin/dolu kaynaklar, sırayla) izlemelidir. */

export type CitationPart =
  | { type: "text"; value: string }
  | { type: "citation"; index: number };

/** "...metin [1] daha metin [2]..." → sıralı parça dizisi. `maxIndex`, o anda
    geçerli en büyük kaynak numarasıdır — bunun dışındaki sayılar (ör. "[42]"
    hiç kaynak olmayan bir metinse) düz metin olarak bırakılır. */
export function parseCitations(text: string, maxIndex: number): CitationPart[] {
  if (!text) return [];
  if (maxIndex <= 0) return [{ type: "text", value: text }];
  const parts: CitationPart[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const idx = Number(m[1]);
    if (idx < 1 || idx > maxIndex) continue;
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    parts.push({ type: "citation", index: idx });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
