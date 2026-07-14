/* GFM işaretleme kutusu (`- [ ] madde`) satırını [ ]/[x] arasında değiştirir.
   Saf fonksiyon — MessageBubble.tsx'teki sohbet-içi tıklanabilir checkbox
   ve olası başka yüzeyler (ör. Doküman/Anket) bunu paylaşabilir. */
export function toggleChecklistLine(content: string, line: number): string {
  const lines = content.split("\n");
  const li = line - 1; // mdast/hast node.position 1-indeksli
  if (li < 0 || li >= lines.length) return content;
  const m = lines[li].match(/^(\s*(?:[-*+]\s+)?)\[([ xX])\](.*)$/);
  if (!m) return content;
  const checked = m[2].trim() !== "";
  lines[li] = `${m[1]}[${checked ? " " : "x"}]${m[3]}`;
  return lines.join("\n");
}
