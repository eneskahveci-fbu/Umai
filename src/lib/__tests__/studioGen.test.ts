import { describe, expect, it } from "vitest";
import { buildStudioSystem } from "../studioGen";

describe("buildStudioSystem — kategori bazlı mükemmellik bilgisi", () => {
  it("deck (İçerik) skill'i için sunum mükemmelliği bilgisini ekler", () => {
    const sys = buildStudioSystem({ skillId: "deck" });
    expect(sys).toContain("SUNUM/İÇERİK MÜKEMMELLİĞİ");
    expect(sys).toContain("Gamma");
  });

  it("dashboard (Uygulama) skill'i için araç/uygulama mükemmelliği bilgisini ekler", () => {
    const sys = buildStudioSystem({ skillId: "dashboard" });
    expect(sys).toContain("ARAÇ/UYGULAMA ARAYÜZÜ MÜKEMMELLİĞİ");
  });

  it("poster (Akademik) skill'i için doküman mükemmelliği bilgisini ekler", () => {
    const sys = buildStudioSystem({ skillId: "poster" });
    expect(sys).toContain("DOKÜMAN/BELGE MÜKEMMELLİĞİ");
    expect(sys).toContain("LibreOffice");
  });

  it("landing (Web) skill'i için web sayfası mükemmelliği bilgisini ekler", () => {
    const sys = buildStudioSystem({ skillId: "landing" });
    expect(sys).toContain("WEB SAYFASI MÜKEMMELLİĞİ");
  });

  it("component (Bileşen) skill'i için bileşen mükemmelliği bilgisini ekler", () => {
    const sys = buildStudioSystem({ skillId: "component" });
    expect(sys).toContain("BİLEŞEN MÜKEMMELLİĞİ");
  });

  it("skillId yoksa (serbest brief) kategori bilgisi eklemez", () => {
    const sys = buildStudioSystem({ skillId: null });
    expect(sys).not.toContain("MÜKEMMELLİĞİ");
  });

  it("bilinmeyen skillId için hata fırlatmaz, kategori bilgisi eklemez", () => {
    const sys = buildStudioSystem({ skillId: "olmayan-skill" });
    expect(sys).not.toContain("MÜKEMMELLİĞİ");
  });
});
