/* Defter "podcast özeti" — NotebookLM'in çok sesli "audio overview" fikrinin
 * Umai yorumu. Saf metin ayrıştırma burada; TTS çalma sırası pollinations.ts'te
 * (playPodcast/stopPodcast), UI akışı NotebookStudio.tsx'te. */

export interface PodcastTurn {
  speaker: "A" | "B";
  text: string;
}

/** LLM çıktısındaki "A: ..." / "B: ..." satırlarını sıralı turlara çevirir.
 *  Biçime uymayan (boş, önek yok) satırlar atlanır — LLM talimata tam uymazsa
 *  çağıran taraf boş diziyi tekli-sese düşürebilir. */
export function parsePodcastScript(raw: string): PodcastTurn[] {
  const turns: PodcastTurn[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*\*{0,2}([AB])\*{0,2}\s*[:：]\s*\*{0,2}\s*(.+)$/);
    if (!m) continue;
    const text = m[2].trim();
    if (!text) continue;
    turns.push({ speaker: m[1] as "A" | "B", text });
  }
  return turns;
}
