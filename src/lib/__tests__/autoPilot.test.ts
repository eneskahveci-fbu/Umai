import { describe, expect, it } from "vitest";
import { decidePilot, autoEffort, autoWeb, autoResearch } from "../autoPilot";

const ctx = { hasRepo: true };

describe("decidePilot", () => {
  it("kısa selam → düşük efor, hiçbir mod", () => {
    const d = decidePilot("selam", ctx);
    expect(d.effort).toBe("low");
    expect(d.web).toBe(false);
    expect(d.research).toBe(false);
    expect(d.quality).toBe(false);
    expect(d.swarm).toBe(false);
  });
  it("güncel bilgi sorusu → web açık", () => {
    expect(decidePilot("bugün dolar kuru ne kadar?", ctx).web).toBe(true);
    expect(decidePilot("İstanbul'da hava durumu nasıl olacak?", ctx).web).toBe(true);
  });
  it("kod odaklı istek web tetiklemez", () => {
    const d = decidePilot("şu fonksiyonu refactor et:\n```ts\nconst x=1\n```", ctx);
    expect(d.web).toBe(false);
    expect(d.effort).toBe("high");
  });
  it("kapsamlı karşılaştırmalı rapor → research + quality (+web)", () => {
    const d = decidePilot("React ile Vue arasında kapsamlı bir karşılaştırmalı analiz raporu hazırla, artıları eksileri kaynaklarıyla anlat", ctx);
    expect(d.research).toBe(true);
    expect(d.web).toBe(true);
    expect(d.quality).toBe(true);
    expect(d.effort).toBe("max");
  });
  it("çok maddeli görev + repo → ajan ekibi", () => {
    const t = "Şu işleri sırayla yap:\n- login sayfası ekle ve doğrulama kur\n- navbar'ı responsive olacak şekilde düzenle\n- birim testleri güncelle\n- README dosyasını yaz ve dağıtım betiği oluştur";
    expect(decidePilot(t, { hasRepo: true }).swarm).toBe(true);
    expect(decidePilot(t, { hasRepo: false }).swarm).toBe(false);
  });
  it("reasons okunur etiketler içerir", () => {
    const d = decidePilot("bugün en yeni Next.js sürümü çıktı mı?", ctx);
    expect(d.reasons).toContain("web");
  });
});

describe("yardımcılar", () => {
  it("autoEffort: kapsamlı → max, kısa soru → medium", () => {
    expect(autoEffort("kapsamlı bir mimari kur")).toBe("max");
    expect(autoEffort("bu nedir?")).toBe("medium");
  });
  it("autoWeb: genel bilgi sorusu tetiklemez", () => {
    expect(autoWeb("Python'da liste nasıl sıralanır?")).toBe(false);
  });
  it("autoResearch: kısa metinde tetiklenmez", () => {
    expect(autoResearch("kapsamlı rapor")).toBe(false);
  });
});

describe("autoStudioSkill", () => {
  it("sunum brief'i → deck", async () => {
    const { autoStudioSkill } = await import("../autoPilot");
    expect(autoStudioSkill("Yapay zekâ konulu 5 slaytlık bir sunum hazırla")).toBe("deck");
  });
  it("e-posta brief'i → email, dashboard → dashboard", async () => {
    const { autoStudioSkill } = await import("../autoPilot");
    expect(autoStudioSkill("kara cuma kampanyası için bir e-posta bülteni")).toBe("email");
    expect(autoStudioSkill("satış analitiği için dashboard tasarla")).toBe("dashboard");
  });
  it("belirsiz brief → null (varsayılana düşer)", async () => {
    const { autoStudioSkill } = await import("../autoPilot");
    expect(autoStudioSkill("güzel bir şey yap")).toBe(null);
  });
});
