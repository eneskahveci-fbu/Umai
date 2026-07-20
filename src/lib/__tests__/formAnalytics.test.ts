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

  it("multi: seçenek METNİ ayracı içerse bile yanlış bölünmez (ayraç çakışması)", () => {
    const collisionForm = normalizeForm({
      title: "Çakışma",
      questions: [{ type: "multi", label: "Tercih?", options: ["Kahve | Çay", "Su"] }],
    })!;
    /* Yalnız "Kahve | Çay" seçilmiş — naif split bunu ["Kahve","Çay"]'e
       bölerdi ve ikisi de tanımsız kalırdı; doğrusu TEK bir seçenek. */
    const s = summarizeResponses(collisionForm, [row(["Kahve | Çay"])]);
    expect(s[0].counts).toEqual([
      { value: "Kahve | Çay", count: 1 },
      { value: "Su", count: 0 },
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

describe("summarizeResponses — question_ids ile doğru eşleme (form düzenlendikten sonra)", () => {
  const [choiceQ, multiQ, ratingQ, shortQ] = form.questions;

  it("sorular yeniden sıralanmış eski bir yanıtta HÂLÂ doğru soruya eşlenir", () => {
    /* Bu yanıt, form'da choice/multi sırası TERSKEN toplanmış (question_ids
       o anki gerçek sırayı yansıtır) — pozisyonel okusaydık answers[0]
       ("TS", aslında multi'nin cevabı) yanlışlıkla choice'a atanırdı. */
    const r: FormResponseRow = {
      answers: ["TS", "Kızıl", "4", "yorum"],
      question_ids: [multiQ.id, choiceQ.id, ratingQ.id, shortQ.id],
      created_at: "2026-07-13T10:00:00Z",
    };
    const s = summarizeResponses(form, [r]);
    expect(s[0].counts?.find((c) => c.value === "Kızıl")?.count).toBe(1); // choice
    expect(s[1].counts?.find((c) => c.value === "TS")?.count).toBe(1); // multi
  });

  it("yanıt toplanırken henüz var olmayan bir soru için boş döner (yanlış eşleşme yok)", () => {
    const r: FormResponseRow = {
      answers: ["Kızıl", "TS"],
      question_ids: [choiceQ.id, multiQ.id], // rating/short o an yoktu
      created_at: "2026-07-13T10:00:00Z",
    };
    const s = summarizeResponses(form, [r]);
    expect(s[2].answered).toBe(0); // rating
    expect(s[3].answered).toBe(0); // short
  });

  it("question_ids yoksa (eski satır) geriye dönük uyum: pozisyonel davranır", () => {
    const r: FormResponseRow = { answers: ["Kızıl", "", "", ""], created_at: "2026-07-13T10:00:00Z" };
    const s = summarizeResponses(form, [r]);
    expect(s[0].counts?.find((c) => c.value === "Kızıl")?.count).toBe(1);
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
