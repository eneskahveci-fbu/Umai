import { describe, expect, it } from "vitest";
import { newCanvasPage, newDeckPage, pageToHtml } from "../openDesign";

describe("pageToHtml", () => {
  it("canvas sayfasını katmanları içeren bağımsız HTML'e çevirir", () => {
    const page = newCanvasPage("poster", "Afiş");
    page.design.layers.push({
      id: "l1", text: "Merhaba <Dünya>", x: 0.5, y: 0.5,
      size: 40, color: "#fff", weight: 700, align: "center", font: "sans-serif",
    });
    const html = pageToHtml(page, "Test Projesi");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Projesi");
    expect(html).toContain("Merhaba &lt;Dünya&gt;");
    expect(html).not.toContain("<Dünya>");
  });

  it("deck sayfasını slayt sunumu HTML'ine çevirir", () => {
    const page = newDeckPage("Sunum");
    page.deck.slides.push({ id: "s1", layout: "bullets", title: "Başlık", bullets: ["a", "b"] });
    const html = pageToHtml(page, "Test Projesi");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Başlık");
    expect(html).toContain("class=\"slide\"");
  });

  it("aiArtifact doluysa katmanlar yerine artifact içeriğini döndürür", () => {
    const page = newCanvasPage("poster", "Afiş");
    page.design.layers.push({
      id: "l1", text: "Bu görünmemeli", x: 0.5, y: 0.5,
      size: 40, color: "#fff", weight: 700, align: "center", font: "sans-serif",
    });
    page.aiArtifact = { type: "html", content: "<h1>AI üretimi</h1>" };
    const html = pageToHtml(page, "Test Projesi");
    expect(html).toContain("AI üretimi");
    expect(html).not.toContain("Bu görünmemeli");
  });

  it("aiArtifact yoksa mevcut katman-tabanlı üretime düşer", () => {
    const page = newCanvasPage("poster", "Afiş");
    page.design.layers.push({
      id: "l1", text: "Katman metni", x: 0.5, y: 0.5,
      size: 40, color: "#fff", weight: 700, align: "center", font: "sans-serif",
    });
    const html = pageToHtml(page, "Test Projesi");
    expect(html).toContain("Katman metni");
  });
});
