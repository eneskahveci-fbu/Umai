/* GFM işaretleme kutusu (`- [ ] madde` VEYA `1. [ ] madde`) satırını [ ]/[x]
   arasında değiştirir. Saf fonksiyon — MessageBubble.tsx'teki sohbet-içi
   tıklanabilir checkbox ve olası başka yüzeyler (ör. Doküman/Anket) bunu
   paylaşabilir.

   Liste işaretçisi hem madde imi (-, *, +) hem NUMARALI liste ("1." / "1)")
   olabilir — ilk sürüm yalnız madde imini tanıyordu, bu yüzden AI'nın
   ürettiği numaralı checklist'ler (canlıda doğrulandı: "1. [ ] seçenek")
   regex'e hiç uymuyor, satır sessizce değişmeden dönüyordu. */
export function toggleChecklistLine(content: string, line: number): string {
  const lines = content.split("\n");
  const li = line - 1; // mdast/hast node.position 1-indeksli
  if (li < 0 || li >= lines.length) return content;
  const m = lines[li].match(/^(\s*(?:(?:[-*+]|\d+[.)])\s+)?)\[([ xX])\](.*)$/);
  if (!m) return content;
  const checked = m[2].trim() !== "";
  lines[li] = `${m[1]}[${checked ? " " : "x"}]${m[3]}`;
  return lines.join("\n");
}
