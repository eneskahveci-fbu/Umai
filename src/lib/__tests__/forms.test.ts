import { describe, it, expect } from "vitest";
import { formToHtml, MAX_FORM_QUESTIONS, normalizeForm, parseFormJson } from "../forms";
import { parseTemplate, templateToJson } from "../templateShare";
import type { CraftForm } from "../types";

describe("normalizeForm / parseFormJson", () => {
  const valid = JSON.stringify({
    title: "Memnuniyet",
    desc: "Kısa anket",
    questions: [
      { type: "short", label: "Adın?", required: true },
      { type: "choice", label: "Renk?", options: ["Kızıl", "Mavi", "  "] },
      { type: "multi", label: "Diller?", options: ["TR"] },      // <2 seçenek → Evet/Hayır
      { type: "rating", label: "Puan?" },
      { type: "acayip", label: "Tür düşer" },
      { label: "   " },                                          // boş etiket → elenir
    ],
  });

  it("soruları doğrular; az seçenekliye varsayılan koyar; bilinmeyen tür short olur", () => {
    const f = parseFormJson(valid);
    expect(f.questions).toHaveLength(5);
    expect(f.questions[0].required).toBe(true);
    expect(f.questions[1].options).toEqual(["Kızıl", "Mavi"]);
    expect(f.questions[2].options).toEqual(["Evet", "Hayır"]);
    expect(f.questions[4].type).toBe("short");
  });

  it(`soru sayısını ${MAX_FORM_QUESTIONS} ile sınırlar`, () => {
    const many = { title: "Çok", questions: Array.from({ length: 99 }, (_, i) => ({ type: "short", label: `S${i}` })) };
    expect(normalizeForm(many)?.questions).toHaveLength(MAX_FORM_QUESTIONS);
  });

  it("bozuk girdide hata fırlatır", () => {
    expect(() => parseFormJson('{"title":"x","questions":[]}')).toThrow();
  });
});

function sampleForm(): CraftForm {
  return {
    id: "f1", title: 'Anket "test" <x>',
    questions: [
      { id: "q1", type: "short", label: "Ad & soyad?", required: true },
      { id: "q2", type: "choice", label: "Seçim", options: ["A", "B"] },
      { id: "q3", type: "rating", label: "Puan" },
    ],
    createdAt: 0, updatedAt: 0,
  };
}

describe("formToHtml — sunucusuz bağımsız form", () => {
  const html = formToHtml(sampleForm());

  it("soru türlerini doğru girdilere çevirir ve HTML'i kaçırır", () => {
    expect(html).toContain('type="text"');
    expect(html).toContain('type="radio"');
    expect(html).toContain("Ad &amp; soyad?");
    expect(html).not.toContain("<x>");
  });

  it("yanıt depolama + CSV indirme scriptini içerir", () => {
    expect(html).toContain("localStorage");
    expect(html).toContain("craft_form_f1");
    expect(html).toContain("text/csv");
  });

  it("zorunlu işareti ve required niteliği koyar", () => {
    expect(html).toContain("required");
  });
});

describe("templateShare — şablon dışa/içe aktarma (Canva'dan ilham)", () => {
  it("form şablonu gidiş-dönüşte korunur, id yenilenir", () => {
    const t = parseTemplate(templateToJson({ kind: "form", data: sampleForm() }));
    expect(t.kind).toBe("form");
    if (t.kind !== "form") return;
    expect(t.data.title).toBe(sampleForm().title);
    expect(t.data.questions).toHaveLength(3);
    expect(t.data.id).not.toBe("f1");
  });

  it("craft şablonu olmayan JSON'u reddeder", () => {
    expect(() => parseTemplate('{"foo":1}')).toThrow(/craft şablon/);
    expect(() => parseTemplate("çöp")).toThrow(/Geçersiz JSON/);
  });

  it("bilinmeyen türü reddeder", () => {
    expect(() => parseTemplate('{"craftTemplate":1,"kind":"resim","data":{}}')).toThrow(/Bilinmeyen/);
  });
});

describe("Faz 6 — yeni soru türleri + koşullu mantık", () => {
  it("dropdown/date türlerini normalize eder, dropdown seçenek alır", () => {
    const f = normalizeForm({ questions: [
      { type: "dropdown", label: "Şehir?", options: ["Ankara", "İzmir"] },
      { type: "date", label: "Tarih?" },
    ] })!;
    expect(f.questions[0].type).toBe("dropdown");
    expect(f.questions[0].options).toEqual(["Ankara", "İzmir"]);
    expect(f.questions[1].type).toBe("date");
  });

  it("showIf indeksini gerçek questionId'ye çevirir (yalnız önceki choice/dropdown)", () => {
    const f = normalizeForm({ questions: [
      { type: "choice", label: "Katıldın mı?", options: ["Evet", "Hayır"] },
      { type: "long", label: "Neden?", showIf: { q: 0, equals: "Hayır" } },
      { type: "short", label: "Geçersiz koşul", showIf: { q: 5, equals: "x" } },
      { type: "short", label: "İleri referans", showIf: { q: 3, equals: "x" } },
    ] })!;
    expect(f.questions[1].showIf).toEqual({ questionId: f.questions[0].id, equals: "Hayır" });
    expect(f.questions[2].showIf).toBeUndefined();
    expect(f.questions[3].showIf).toBeUndefined();
  });

  it("formToHtml dropdown'a select, date'e input[type=date] üretir", () => {
    const f = normalizeForm({ questions: [
      { type: "dropdown", label: "Şehir?", options: ["Ankara", "İzmir"] },
      { type: "date", label: "Ne zaman?" },
    ] })!;
    const html = formToHtml(f);
    expect(html).toContain("<select");
    expect(html).toContain("Seçiniz…");
    expect(html).toContain('type="date"');
  });

  it("formToHtml koşul kurallarını LOGIC olarak gömer ve sarmalayıcı id'leri üretir", () => {
    const f = normalizeForm({ questions: [
      { type: "choice", label: "Katıldın mı?", options: ["Evet", "Hayır"] },
      { type: "long", label: "Neden?", showIf: { q: 0, equals: "Hayır" } },
    ] })!;
    const html = formToHtml(f);
    expect(html).toContain('"t":1');
    expect(html).toContain('"s":0');
    expect(html).toContain('"eq":"Hayır"');
    expect(html).toContain('id="qw1"');
    expect(html).toContain("applyLogic");
  });

  it("koşulsuz ankette LOGIC boş kalır (mevcut davranış değişmez)", () => {
    const f = normalizeForm({ questions: [{ type: "short", label: "Ad?" }] })!;
    expect(formToHtml(f)).toContain("var LOGIC = []");
  });
});

describe("Faz 7 — merkezî yanıt toplama (collect)", () => {
  const f = () => normalizeForm({ questions: [{ type: "short", label: "Ad?" }] })!;

  it("collect verilince COLLECT config + fetch gömülür ve dolduran bilgilendirilir", () => {
    const form = f();
    const html = formToHtml(form, { collect: { url: "https://umai.app/api/forms/respond" } });
    expect(html).toContain('"url":"https://umai.app/api/forms/respond"');
    expect(html).toContain(`"formId":"${form.id}"`);
    expect(html).toContain("fetch(COLLECT.url");
    expect(html).toContain("form sahibine iletilir");
  });

  it("collect YOKKEN form saf sunucusuz kalır (COLLECT null, fetch tetiklenmez)", () => {
    const html = formToHtml(f());
    expect(html).toContain("var COLLECT = null");
    expect(html).toContain("sunucusuz, yanıtlar bu cihazda saklanır");
    expect(html).not.toContain("api/forms/respond");
  });
});
