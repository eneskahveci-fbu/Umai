import { describe, expect, it } from "vitest";
import { friendlyError } from "../friendlyError";

describe("friendlyError", () => {
  it("429/kota → sınır mesajı", () => {
    expect(friendlyError("HTTP 429 Too Many Requests")).toContain("sınır");
    expect(friendlyError("insufficient_quota")).toContain("kota");
  });
  it("401/403 → anahtar mesajı", () => {
    expect(friendlyError("401 Unauthorized: invalid api key")).toContain("anahtar");
    expect(friendlyError("403 authentication failed")).toContain("anahtar");
  });
  it("5xx/aşırı yük → yoğunluk mesajı", () => {
    expect(friendlyError("502 Bad Gateway... server error")).toContain("yoğun");
    expect(friendlyError("model is overloaded")).toContain("yoğun");
  });
  it("ağ hatası → bağlantı mesajı", () => {
    expect(friendlyError("TypeError: Failed to fetch")).toContain("bağlantı");
  });
  it("model bulunamadı → model mesajı", () => {
    expect(friendlyError("The model `foo` does not exist")).toContain("Model bulunamadı");
  });
  it("eşleşme yoksa ham metni döndürür", () => {
    expect(friendlyError("tuhaf özel durum")).toBe("tuhaf özel durum");
  });
});
