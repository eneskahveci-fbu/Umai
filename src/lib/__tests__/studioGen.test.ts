import { describe, expect, it } from "vitest";
import { buildStudioSystem, ensureFontLink, parseCritique } from "../studioGen";

describe("buildStudioSystem — kategori bazlı mükemmellik bilgisi", () => {
  it("deck (İçerik) skill'i için sunum mükemmelliği bilgisini ekler", () => {
    const sys = buildStudioSystem({ skillId: "deck" });
    expect(sys).toContain("SUNUM/İÇERİK MÜKEMMELLİĞİ");
    expect(sys).toContain("Gamma");
  });

  it("slides (İçerik, çok slaytlı motor) skill'i için de sunum mükemmelliği bilgisini ekler", () => {
    /* generateArtifact/buildStudioSystem bu skil için DesignStudio.tsx'te
       baypas edilir (slidesGen.generateDeck() kullanılır) — yine de skillById
       ile çözümlenebilir olmalı ve aynı "İçerik" kategori bilgisini taşımalı. */
    const sys = buildStudioSystem({ skillId: "slides" });
    expect(sys).toContain("SUNUM/İÇERİK MÜKEMMELLİĞİ");
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

describe("buildStudioSystem — H2: referans görsel derinleştirme", () => {
  it("images verilmişse görseli somut tasarım girdisi olarak kullanma talimatı ekler", () => {
    const sys = buildStudioSystem({ skillId: null, images: ["data:image/png;base64,abc"] });
    expect(sys).toContain("[REFERANS GÖRSEL]");
    expect(sys).toContain("baskın renk paletini");
  });

  it("images boşsa/yoksa referans görsel talimatı eklenmez", () => {
    expect(buildStudioSystem({ skillId: null })).not.toContain("[REFERANS GÖRSEL]");
    expect(buildStudioSystem({ skillId: null, images: [] })).not.toContain("[REFERANS GÖRSEL]");
  });

  it("marka tasarım sistemiyle birlikte kullanılınca marka bloğundan SONRA gelir (marka önceliği)", () => {
    const sys = buildStudioSystem({ skillId: null, designSystemPrompt: "Marka: Test\nAçıklama.", images: ["data:image/png;base64,abc"] });
    expect(sys.indexOf("Marka: Test")).toBeLessThan(sys.indexOf("[REFERANS GÖRSEL]"));
  });
});

describe("ensureFontLink — H3: Google Fonts <head>'e garanti enjeksiyonu", () => {
  const LINK = '<link href="https://fonts.googleapis.com/css2?family=Fraunces" rel="stylesheet">';

  it("</head> varsa hemen öncesine ekler", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const out = ensureFontLink(html, LINK);
    expect(out).toContain(`${LINK}</head>`);
  });

  it("<head> açık ama kapanışı yoksa (nadiren), yine de <head ...> hemen sonrasına ekler", () => {
    const html = "<html><head><title>x</title>";
    const out = ensureFontLink(html, LINK);
    expect(out.startsWith(`<html><head>${LINK}`)).toBe(true);
  });

  it("<head> hiç yoksa dokunmadan bırakır (parçalı/component çıktı)", () => {
    const html = "<div>yalnız bir parça</div>";
    expect(ensureFontLink(html, LINK)).toBe(html);
  });

  it("fontLink zaten eklenmişse (model kendi eklediyse) yinelemez", () => {
    const html = `<html><head>${LINK}</head><body></body></html>`;
    expect(ensureFontLink(html, LINK)).toBe(html);
  });

  it("fontLink undefined ise html'i değiştirmeden döner", () => {
    const html = "<html><head></head><body></body></html>";
    expect(ensureFontLink(html, undefined)).toBe(html);
  });
});

describe("parseCritique — H1: eleştiri yanıtından not ayıklama", () => {
  it("sorun varsa note'u döner", () => {
    const raw = '{"ok": false, "note": "Başlık ile gövde arasında kontrast zayıf."}';
    expect(parseCritique(raw)).toBe("Başlık ile gövde arasında kontrast zayıf.");
  });

  it("ok:true ve boş note ise null döner (temiz — not gösterilmez)", () => {
    expect(parseCritique('{"ok": true, "note": ""}')).toBeNull();
  });

  it("```json çitli yanıtı da ayıklar", () => {
    const raw = 'İşte değerlendirmem:\n```json\n{"ok": false, "note": "Kartlar tekdüze."}\n```';
    expect(parseCritique(raw)).toBe("Kartlar tekdüze.");
  });

  it("bozuk/JSON-olmayan yanıtta null döner (üretimi engellemez)", () => {
    expect(parseCritique("bunu değerlendiremedim")).toBeNull();
    expect(parseCritique("{{{ bozuk json")).toBeNull();
  });
});
