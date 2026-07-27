import { describe, expect, it } from "vitest";
import {
  extractBlocks, pickBlock, classifyFailure, failureMessage, STRICT_FORMAT_REMINDER,
} from "../studioExtract";

/* Kullanıcı hata raporu: "Bana cv şablonu yap" ve "Bana odyssey hakkında slayt
   yap" — ikisi de "Üretim ayrıştırılamadı — brief'i biraz daha açık yaz."
   veriyordu. Mesaj hem yanlış yönlendiriyor hem gerçek nedeni gizliyordu. */

describe("extractBlocks — kapanmış bloklar", () => {
  it("tek bloğu dil etiketiyle çıkarır", () => {
    const b = extractBlocks("Önsöz\n```html\n<p>merhaba</p>\n```\nSonsöz");
    expect(b).toHaveLength(1);
    expect(b[0].lang).toBe("html");
    expect(b[0].code.trim()).toBe("<p>merhaba</p>");
    expect(b[0].truncated).toBe(false);
  });

  it("birden çok bloğu sırayla çıkarır", () => {
    const b = extractBlocks("```css\na{}\n```\n```html\n<b/>\n```");
    expect(b.map((x) => x.lang)).toEqual(["css", "html"]);
  });

  it("dil etiketi yoksa boş lang döner", () => {
    expect(extractBlocks("```\ndüz\n```")[0].lang).toBe("");
  });
});

describe("extractBlocks — KAPANMAMIŞ blok (asıl hata)", () => {
  it("token sınırında kesilmiş bloğu kurtarır ve truncated işaretler", () => {
    const b = extractBlocks("```html\n<!doctype html><html><body><h1>CV");
    expect(b).toHaveLength(1);
    expect(b[0].lang).toBe("html");
    expect(b[0].truncated).toBe(true);
    expect(b[0].code).toContain("<h1>CV");
  });

  it("markdown yarıda kesilse de kurtarılır (eski /<[a-z]/ yedeği bunu kaçırıyordu)", () => {
    const b = extractBlocks("```markdown\n# Özgeçmiş\n\n## Deneyim\n- Bir");
    expect(b[0].lang).toBe("markdown");
    expect(b[0].truncated).toBe(true);
  });

  it("kapanmış blokların ARDINDAN gelen açık bloğu da alır", () => {
    const b = extractBlocks("```css\na{}\n```\n```html\n<div>kesik");
    expect(b).toHaveLength(2);
    expect(b[1].lang).toBe("html");
    expect(b[1].truncated).toBe(true);
  });

  it("boş gövdeli açık çiti blok saymaz", () => {
    expect(extractBlocks("Bir açıklama\n```html\n")).toHaveLength(0);
  });

  it("hiç çit yoksa boş döner", () => {
    expect(extractBlocks("Sadece düz metin.")).toEqual([]);
    expect(extractBlocks("")).toEqual([]);
  });
});

describe("pickBlock", () => {
  it("görsel türleri önceler", () => {
    const blocks = extractBlocks("```css\na{}\n```\n```html\n<b/>\n```");
    expect(pickBlock(blocks)?.lang).toBe("html");
  });

  it("tercihli tür yoksa ilk bloğu verir", () => {
    const blocks = extractBlocks("```python\nprint(1)\n```");
    expect(pickBlock(blocks)?.lang).toBe("python");
  });

  it("blok yoksa undefined", () => {
    expect(pickBlock([])).toBeUndefined();
  });
});

describe("classifyFailure / failureMessage — dürüst hata", () => {
  it("boş yanıtı 'empty' sayar ve brief'i SUÇLAMAZ", () => {
    expect(classifyFailure("")).toBe("empty");
    expect(classifyFailure("   \n ")).toBe("empty");
    const msg = failureMessage("empty", "");
    expect(msg).toContain("boş yanıt");
    expect(msg).not.toContain("brief");
  });

  it("düz metin yanıtı 'prose' sayar ve MODELİN NE DEDİĞİNİ gösterir", () => {
    const text = "Tabii, size bir CV şablonu hazırlayabilirim. Hangi sektör için olsun?";
    expect(classifyFailure(text)).toBe("prose");
    const msg = failureMessage("prose", text);
    expect(msg).toContain("Hangi sektör için olsun?");
  });

  it("çok uzun yanıtı kırpar (hata kutusu taşmasın)", () => {
    const msg = failureMessage("prose", "x".repeat(500));
    expect(msg).toContain("…");
    expect(msg.length).toBeLessThan(260);
  });
});

describe("STRICT_FORMAT_REMINDER", () => {
  it("yeniden denemede açıklama yazmayı yasaklar ve çit ister", () => {
    expect(STRICT_FORMAT_REMINDER).toMatch(/AÇIKLAMA YAZMA/);
    expect(STRICT_FORMAT_REMINDER).toContain("```");
  });
});
