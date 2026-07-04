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
