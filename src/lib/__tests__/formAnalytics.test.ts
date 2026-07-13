import { describe, it, expect } from "vitest";
import { responsesToCsv, summarizeResponses, type FormResponseRow } from "../formAnalytics";
import { normalizeForm } from "../forms";

const form = normalizeForm({
  title: "Test",
  questions: [
    { type: "choice", label: "Renk?", options: ["Kızıl", "Mavi"] },
    { type: "multi", label: "Diller?", options: ["TS", "Go"] },
    { type: "rating", label: "Puan?" },
    { type: "short", label: "Yorum?" },
  ],
})!;

const row = (answers: unknown, t = "2026-07-13T10:00:00Z"): FormResponseRow => ({ answers, created_at: t });

describe("summarizeResponses", () => {
  it("choice: tanımlı seçenekleri 0'la listeler, gelenleri sayar", () => {
    const s = summarizeResponses(form, [row(["Kızıl", "", "", ""]), row(["Kızıl", "", "", ""]), row(["Yeşil", "", "", ""])]);
    expect(s[0].answered).toBe(3);
    expect(s[0].counts).toEqual([
      { value: "Kızıl", count: 2 },
      { value: "Mavi", count: 0 },
      { value: "Yeşil", count: 1 }, // tanımsız ama gelen değer de görünür
    ]);
  });

  it("multi: ' | ' ayracıyla birleşik seçimleri ayırıp sayar", () => {
    const s = summarizeResponses(form, [row(["", "TS | Go", "", ""]), row(["", "TS", "", ""])]);
    expect(s[1].counts).toEqual([
      { value: "TS", count: 2 },
      { value: "Go", count: 1 },
    ]);
  });

  it("rating: 1-5 dağılımı + ortalama", () => {
    const s = summarizeResponses(form, [row(["", "", "4", ""]), row(["", "", "5", ""])]);
    expect(s[2].average).toBe(4.5);
    expect(s[2].counts!.find((c) => c.value === "4")!.count).toBe(1);
    expect(s[2].counts!.find((c) => c.value === "1")!.count).toBe(0);
  });

  it("metin: örnekleri sırayla toplar, boşları saymaz; bozuk answers tolere edilir", () => {
    const s = summarizeResponses(form, [row(["", "", "", "harika"]), row("çöp-dizi-değil"), row(["", "", "", ""])]);
    expect(s[3].answered).toBe(1);
    expect(s[3].samples).toEqual(["harika"]);
  });
});

describe("responsesToCsv", () => {
  it("BOM + başlık satırı + tırnak kaçışı", () => {
    const csv = responsesToCsv(form, [row(['de"neme', "", "", ""], "2026-07-13T10:00:00Z")]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Zaman","Renk?","Diller?","Puan?","Yorum?"');
    expect(csv).toContain('"de""neme"');
  });
});
