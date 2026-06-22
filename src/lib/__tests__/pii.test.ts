import { describe, expect, it } from "vitest";
import { detectSensitive } from "../pii";

describe("detectSensitive", () => {
  it("API anahtarlarını yakalar", () => {
    expect(detectSensitive("anahtarım sk-abcdef0123456789ABCDEF")).toContain("API anahtarı");
    expect(detectSensitive("gsk_1234567890abcdef1234")).toContain("API anahtarı");
    expect(detectSensitive("AIzaSyA1234567890abcdefghij1234567")).toContain("API anahtarı");
    expect(detectSensitive("glpat-mCDVC6mh-dHrryeDcNhD")).toContain("API anahtarı");
  });

  it("geçerli kredi kartını (Luhn) yakalar, rastgele sayıyı yakalamaz", () => {
    expect(detectSensitive("kart 4242 4242 4242 4242")).toContain("kredi kartı");
    expect(detectSensitive("sipariş no 1234 5678 9012 3456")).not.toContain("kredi kartı");
  });

  it("IBAN'ı yakalar", () => {
    expect(detectSensitive("TR330006100519786457841326")).toContain("IBAN");
  });

  it("meşru metinde (e-posta, kısa sayı) uyarı vermez", () => {
    expect(detectSensitive("bana ahmet@site.com adresine yaz, fiyat 1500 TL")).toEqual([]);
    expect(detectSensitive("merhaba dünya")).toEqual([]);
  });

  it("boş/whitespace güvenli", () => {
    expect(detectSensitive("")).toEqual([]);
  });
});
