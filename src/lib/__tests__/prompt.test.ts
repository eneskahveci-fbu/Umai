import { describe, expect, it } from "vitest";
import { selectRelevantSkills } from "../prompt";

/* K1: skill seçimi artık genChat.ts (Stüdyo motorları) VE CoderView.tsx
   (ana sohbet) tarafından PAYLAŞILAN tek kaynak — önceden genChat.ts
   dizideki İLK 5'i alaka gözetmeden alıyordu. */

interface TestSkill { id: string; title: string; content: string; tags?: string[] }

function skill(id: string, title: string, content: string, tags: string[] = []): TestSkill {
  return { id, title, content, tags };
}

describe("selectRelevantSkills", () => {
  it("max'ı aşmayan listede hepsini olduğu gibi döner (seçim maliyeti yok)", () => {
    const all = [skill("1", "A", "x"), skill("2", "B", "y")];
    expect(selectRelevantSkills(all, "herhangi bir sorgu", 5)).toEqual(all);
  });

  it("max'ı aşan listede sorgu kelimesiyle en çok örtüşeni önceliklendirir", () => {
    const all = [
      skill("1", "Alakasız", "bununla hiç ilgisi yok bir şey"),
      skill("2", "Pazarlama tonu", "pazarlama metinlerinde samimi ton kullan, pazarlama odaklı yaz"),
      skill("3", "Kod stili", "TypeScript'te always strict mode kullan"),
      skill("4", "Diğer", "tamamen farklı bir konu"),
      skill("5", "Beşinci", "yine alakasız içerik"),
      skill("6", "Altıncı", "yine alakasız içerik"),
    ];
    const out = selectRelevantSkills(all, "bana pazarlama odaklı bir metin yaz", 5);
    expect(out).toHaveLength(5);
    expect(out[0].id).toBe("2");
  });

  it("etiketler de örtüşme puanına katkı sağlar", () => {
    const all = [
      skill("1", "Genel", "genel içerik", ["genel"]),
      skill("2", "Özel", "kısa", ["muhasebe", "finans"]),
      skill("3", "Diğer1", "içerik", []),
      skill("4", "Diğer2", "içerik", []),
      skill("5", "Diğer3", "içerik", []),
      skill("6", "Diğer4", "içerik", []),
    ];
    const out = selectRelevantSkills(all, "finans raporu hazırla", 5);
    expect(out.map((s) => s.id)).toContain("2");
  });

  it("sorguda 3 karakterden uzun anlamlı kelime yoksa (ör. tamamı kısa/boş) dizinin başından max kadarını döner", () => {
    const all = Array.from({ length: 7 }, (_, i) => skill(String(i), `S${i}`, "içerik"));
    const out = selectRelevantSkills(all, "a b c", 5);
    expect(out).toHaveLength(5);
    expect(out.map((s) => s.id)).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("boş sorguda dizinin başından max kadarını döner", () => {
    const all = Array.from({ length: 7 }, (_, i) => skill(String(i), `S${i}`, "içerik"));
    expect(selectRelevantSkills(all, "", 5)).toHaveLength(5);
  });

  it("eşit puanlı öğelerde bile daima tam olarak max adet döner", () => {
    const all = Array.from({ length: 8 }, (_, i) => skill(String(i), `Aynı${i}`, "aynı içerik burada"));
    expect(selectRelevantSkills(all, "aynı içerik ara", 5)).toHaveLength(5);
  });
});
