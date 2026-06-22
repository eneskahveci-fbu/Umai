import { describe, expect, it } from "vitest";
import { detectSensitive } from "../pii";

/* NOT: test değerleri kasıtlı SAHTE ve düşük-entropili (gerçek anahtar değil) —
   regex'i doğrular ama gizli-tarama/push-koruması tetiklemez. */
describe("detectSensitive", () => {
  it("API anahtarı önekli dizeleri yakalar", () => {
    expect(detectSensitive("anahtar sk-aaaaaaaaaaaaaaaa0000")).toContain("API anahtarı");
    expect(detectSensitive("gsk_aaaaaaaaaaaaaaaa0000")).toContain("API anahtarı");
    expect(detectSensitive("AIzaAAAAAAAAAAAAAAAAAAAA0000")).toContain("API anahtarı");
    expect(detectSensitive("glpat-aaaaaaaaaaaaaaaa0000")).toContain("API anahtarı");
  });

  it("geçerli kredi kartını (Luhn) yakalar, rastgele sayıyı yakalamaz", () => {
    expect(detectSensitive("kart 4242 4242 4242 4242")).toContain("kredi kartı");
    expect(detectSensitive("sipariş no 1234 5678 9012 3456")).not.toContain("kredi kartı");
  });

  it("IBAN biçimini yakalar", () => {
    expect(detectSensitive("TR000000000000000000000000")).toContain("IBAN");
  });

  it("meşru metinde (e-posta, kısa sayı) uyarı vermez", () => {
    expect(detectSensitive("bana ahmet@site.com adresine yaz, fiyat 1500 TL")).toEqual([]);
    expect(detectSensitive("merhaba dünya")).toEqual([]);
  });

  it("boş güvenli", () => {
    expect(detectSensitive("")).toEqual([]);
  });
});
