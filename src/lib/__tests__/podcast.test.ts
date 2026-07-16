import { describe, it, expect } from "vitest";
import { parsePodcastScript } from "../podcast";

describe("parsePodcastScript — Defter podcast özeti betiği ayrıştırma", () => {
  it("A:/B: satırlarını sıralı turlara çevirir", () => {
    const raw = "A: Merhaba, bugün ilginç bir konuyu konuşacağız.\nB: Evet, çok merak ediyorum.\nA: Şöyle başlayalım...";
    const turns = parsePodcastScript(raw);
    expect(turns).toEqual([
      { speaker: "A", text: "Merhaba, bugün ilginç bir konuyu konuşacağız." },
      { speaker: "B", text: "Evet, çok merak ediyorum." },
      { speaker: "A", text: "Şöyle başlayalım..." },
    ]);
  });

  it("biçime uymayan/boş satırları atlar", () => {
    const raw = "Podcast betiği:\n\nA: İlk cümle.\nBu satır yok sayılır.\nB: İkinci cümle.\n";
    const turns = parsePodcastScript(raw);
    expect(turns).toEqual([
      { speaker: "A", text: "İlk cümle." },
      { speaker: "B", text: "İkinci cümle." },
    ]);
  });

  it("kalın işaretli konuşmacı etiketini (**A:**) de kabul eder", () => {
    const turns = parsePodcastScript("**A:** Kalın etiketli satır.\n**B:** Diğeri.");
    expect(turns).toEqual([
      { speaker: "A", text: "Kalın etiketli satır." },
      { speaker: "B", text: "Diğeri." },
    ]);
  });

  it("hiç eşleşme yoksa boş dizi döner", () => {
    expect(parsePodcastScript("Bu metin hiç A: veya B: içermiyor gibi görünsün diye yazıldı.")).toEqual([]);
    expect(parsePodcastScript("")).toEqual([]);
  });

  it("cümle içindeki ek iki noktaları bozmadan yakalar", () => {
    const turns = parsePodcastScript("A: Bence şöyle: gerçekten ilginç bir bulgu.");
    expect(turns).toEqual([{ speaker: "A", text: "Bence şöyle: gerçekten ilginç bir bulgu." }]);
  });
});
