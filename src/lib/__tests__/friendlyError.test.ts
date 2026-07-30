import { describe, expect, it } from "vitest";
import { friendlyError, friendlyErrorFrom, ModelOutputError } from "../friendlyError";

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

/* Denetim bulgusu (Tem 2026): friendlyError desenleri ham metinde arıyordu ve
   "500|502|503" dizede HERHANGİ bir yerde eşleşiyordu. Modelin kendi yanıtından
   alınan bir örnek ("500 kelimelik bir metin…") bu yüzden "Sağlayıcı şu an
   yoğun…" diye çevriliyor, studioExtract.ts'in ortadan kaldırmak için yazıldığı
   yanlış teşhis geri geliyordu. */
describe("friendlyErrorFrom — modelin kendi metni sağlayıcı hatası sanılmaz", () => {
  it("ModelOutputError mesajı OLDUĞU GİBİ geçer (içinde 500/404 geçse bile)", () => {
    const e = new ModelOutputError(
      'Model kod bloğu yerine düz metin döndürdü. Modelin yanıtı: "Tabii, işte 500 kelimelik bir özet…"',
    );
    const out = friendlyErrorFrom(e);
    expect(out).toContain("500 kelimelik");
    expect(out).not.toContain("Sağlayıcı şu an yoğun");
  });

  it("404 içeren model prozası da ezilmez", () => {
    const e = new ModelOutputError('Modelin yanıtı: "Sana bir 404 hata sayfası tasarlayabilirim…"');
    expect(friendlyErrorFrom(e)).toContain("404 hata sayfası");
    expect(friendlyErrorFrom(e)).not.toContain("Model bulunamadı");
  });

  it("GERÇEK sağlayıcı hatası hâlâ çevrilir", () => {
    expect(friendlyErrorFrom(new Error("HTTP 503 Service Unavailable"))).toContain("yoğun");
    expect(friendlyErrorFrom(new Error("401 Unauthorized"))).toContain("API anahtarı");
  });

  it("AbortError kullanıcı diline çevrilir", () => {
    const e = new Error("aborted");
    e.name = "AbortError";
    expect(friendlyErrorFrom(e)).toContain("iptal");
  });

  it("Error olmayan değerlerde yedek metne düşer", () => {
    expect(friendlyErrorFrom(undefined)).toBe("bilinmeyen hata");
    expect(friendlyErrorFrom("tuhaf özel durum")).toBe("tuhaf özel durum");
  });
});

/* \b sınırları — ikinci savunma hattı: prozadaki büyük sayılar yanlış eşleşmesin. */
describe("friendlyError — kelime sınırları", () => {
  it("1500/4041 gibi sayılar sağlayıcı hatası sanılmaz", () => {
    expect(friendlyError("1500 kelimelik bir rapor yaz")).toBe("1500 kelimelik bir rapor yaz");
    expect(friendlyError("ürün kodu 4041 bulunamadı diyemem")).not.toContain("Model bulunamadı");
  });
  it("gerçek durum kodları hâlâ eşleşir", () => {
    expect(friendlyError("Provider returned 503")).toContain("yoğun");
    expect(friendlyError("Error 429: rate limited")).toContain("rate limit");
  });
});
