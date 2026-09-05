import { describe, expect, it } from "vitest";
import { sanitizeAiTitle } from "../chatTitle";

describe("sanitizeAiTitle", () => {
  it("düzgün kısa başlığı olduğu gibi kabul eder", () => {
    expect(sanitizeAiTitle("React useEffect Kuralları")).toBe("React useEffect Kuralları");
    expect(sanitizeAiTitle("Kahve Dükkânı İçin Site")).toBe("Kahve Dükkânı İçin Site");
  });

  it("tırnak, 'Başlık:' öneki ve son noktalamayı temizler", () => {
    expect(sanitizeAiTitle('"Todo Uygulaması"')).toBe("Todo Uygulaması");
    expect(sanitizeAiTitle("Başlık: Todo Uygulaması")).toBe("Todo Uygulaması");
    expect(sanitizeAiTitle("Todo Uygulaması.")).toBe("Todo Uygulaması");
    expect(sanitizeAiTitle("«Hata Ayıklama»\nikinci satır")).toBe("Hata Ayıklama");
  });

  it("REGRESYON: cevaba başlayan giriş cümlesini reddeder — eski kod bunu başlık yapıyordu", () => {
    expect(sanitizeAiTitle("Tabii, işte basit bir sayfa:")).toBeNull();
    expect(sanitizeAiTitle("Elbette! Aşağıda kodu bulabilirsin")).toBeNull();
    expect(sanitizeAiTitle("İşte kodun")).toBeNull(); // büyük İ — tr küçültme
    expect(sanitizeAiTitle("Merhaba")).toBeNull();
  });

  it("uzun cümleyi ve 60 karakter üstünü reddeder", () => {
    expect(sanitizeAiTitle("Bu fonksiyon render tamamlandıktan sonra çalışır ve bağımlılıkları izler")).toBeNull();
    expect(sanitizeAiTitle("x".repeat(61))).toBeNull();
  });

  it("boş/null girdide null döner", () => {
    expect(sanitizeAiTitle("")).toBeNull();
    expect(sanitizeAiTitle(null)).toBeNull();
    expect(sanitizeAiTitle("   \n  ")).toBeNull();
  });

  it("açılış kelimesi başlığın İÇİNDE geçince reddetmez (yalnız başta)", () => {
    expect(sanitizeAiTitle("Selamlaşma Botu Tasarımı")).toBe("Selamlaşma Botu Tasarımı"); // "selam" öneki ama kelime değil
    expect(sanitizeAiTitle("Tamamlayıcı Renk Paleti")).toBe("Tamamlayıcı Renk Paleti");   // "tamam" öneki ama kelime değil
  });
});
