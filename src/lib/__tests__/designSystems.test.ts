import { describe, it, expect } from "vitest";
import { bundledDesignSystems, designSystemById, designSystemPromptText } from "../designSystems";

describe("bundledDesignSystems — bütünlük", () => {
  it("her sistemin benzersiz bir id'si var", () => {
    const ids = bundledDesignSystems.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tokensCss --font-heading değişkenini de içerir", () => {
    for (const s of bundledDesignSystems) {
      expect(s.tokensCss).toContain("--font-heading:");
    }
  });
});

describe("H3 — Google Fonts fontLink", () => {
  it("gerçek bir Google Font kullanan sistemlerde fontLink dolu ve <link> içerir", () => {
    const craft = designSystemById("craft")!;
    expect(craft.fontLink).toBeTruthy();
    expect(craft.fontLink).toContain("fonts.googleapis.com/css2");
    expect(craft.fontLink).toContain("family=Fraunces");
    expect(craft.fontLink).toContain("family=Inter");
  });

  it("aynı aile hem başlık hem gövdede kullanılsa tek kez eklenir (tekrarsız)", () => {
    const openai = designSystemById("openai")!;
    const matches = openai.fontLink?.match(/family=Inter/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("preconnect etiketlerini içerir (performans)", () => {
    const linear = designSystemById("linear")!;
    expect(linear.fontLink).toContain("rel=\"preconnect\"");
  });

  it("her sistem için bir accent rengi ve designMd metni tanımlı", () => {
    for (const s of bundledDesignSystems) {
      expect(s.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.designMd.length).toBeGreaterThan(20);
    }
  });
});

describe("designSystemPromptText — fontLink varsa embed talimatı ekler", () => {
  it("fontLink dolu sistemlerde otomatik enjeksiyon notunu ekler (model tekrar <link> eklemesin)", () => {
    const craft = designSystemById("craft")!;
    const text = designSystemPromptText(craft);
    expect(text).toContain("var(--font-heading)");
    expect(text).toContain("otomatik olarak");
  });
});
