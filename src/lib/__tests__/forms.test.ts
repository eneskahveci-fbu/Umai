import { describe, it, expect } from "vitest";
import { formToHtml, MAX_FORM_QUESTIONS, MAX_QUESTION_OPTIONS, normalizeForm, parseFormJson, parseOptionsDraft } from "../forms";
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
    expect(html).toContain("refreshVisibility");
  });

  it("koşulsuz ankette LOGIC boş kalır (mevcut davranış değişmez)", () => {
    const f = normalizeForm({ questions: [{ type: "short", label: "Ad?" }] })!;
    expect(formToHtml(f)).toContain("var LOGIC = []");
  });
});

describe("Faz 11 — dosya yükleme soru tipi + çok sayfalı form", () => {
  it("normalizeForm 'file' türünü kabul eder", () => {
    const f = normalizeForm({ questions: [{ type: "file", label: "Belge yükle" }] })!;
    expect(f.questions[0].type).toBe("file");
  });

  it("formToHtml file sorusu için input[type=file] + bilgi notu üretir", () => {
    const f = normalizeForm({ questions: [{ type: "file", label: "Belge" }] })!;
    const html = formToHtml(f);
    expect(html).toContain('type="file"');
    expect(html).toContain("içeriği sunucuya/CSV'ye gönderilmez");
  });

  it("pageBreakAfter yoksa tek sayfa üretir, nav butonları render edilmez (mevcut davranış korunur)", () => {
    const f = normalizeForm({ questions: [{ type: "short", label: "A" }, { type: "short", label: "B" }] })!;
    const html = formToHtml(f);
    expect(html).toContain("var PAGES = [[0,1]]");
    expect(html).not.toContain('id="nextBtn"');
    expect(html).not.toContain('id="prevBtn"');
  });

  it("pageBreakAfter işaretlenen sorudan sonra yeni sayfa başlar, nav butonları render edilir", () => {
    const f = normalizeForm({ questions: [
      { type: "short", label: "A", pageBreakAfter: true },
      { type: "short", label: "B" },
    ] })!;
    const html = formToHtml(f);
    expect(html).toContain("var PAGES = [[0],[1]]");
    expect(html).toContain('id="nextBtn"');
    expect(html).toContain('id="prevBtn"');
    expect(html).toContain('id="submitBtn"');
    expect(html).toContain("Sayfa 1 / 2");
  });

  it("son sorudaki pageBreakAfter göz ardı edilir (boş sondan sayfa açılmaz)", () => {
    const f = normalizeForm({ questions: [{ type: "short", label: "A", pageBreakAfter: true }] })!;
    const html = formToHtml(f);
    expect(html).toContain("var PAGES = [[0]]");
  });

  it("şablon gidiş-dönüşünde pageBreakAfter + file türü korunur", () => {
    const form: CraftForm = {
      id: "f2", title: "T",
      questions: [
        { id: "q1", type: "file", label: "Belge", pageBreakAfter: true },
        { id: "q2", type: "short", label: "Ad" },
      ],
      createdAt: 0, updatedAt: 0,
    };
    const t = parseTemplate(templateToJson({ kind: "form", data: form }));
    expect(t.kind).toBe("form");
    if (t.kind !== "form") return;
    expect(t.data.questions[0].type).toBe("file");
    expect(t.data.questions[0].pageBreakAfter).toBe(true);
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

/* Kullanıcı hata raporu: çoktan seçmeli soruda Enter'a basınca yeni seçenek
   satırı AÇILMIYORDU. Kontrollü textarea `onChange` içinde boş satırları
   anında eliyordu; geri yazılan değer aynı kalınca React yeni satırı hiç
   render etmiyor, imleç geri sıçrıyordu. Ayrıştırma artık saf ve ayrı. */
describe("parseOptionsDraft", () => {
  it("satırları seçeneklere çevirir", () => {
    expect(parseOptionsDraft("A\nB\nC")).toEqual(["A", "B", "C"]);
  });
  it("sondaki boş satırı (Enter'ın açtığı) sonuçtan düşürür ama metni bozmaz", () => {
    expect(parseOptionsDraft("A\nB\n")).toEqual(["A", "B"]);
  });
  it("aradaki boş satırlar ve yalnız-boşluk satırları elenir", () => {
    expect(parseOptionsDraft("A\n\n   \nB")).toEqual(["A", "B"]);
  });
  it("baştaki/sondaki boşluklar kırpılır", () => {
    expect(parseOptionsDraft("  A  \n\tB\t")).toEqual(["A", "B"]);
  });
  it("üst sınırı aşan seçenekler kırpılır", () => {
    const many = Array.from({ length: 25 }, (_, i) => `S${i}`).join("\n");
    expect(parseOptionsDraft(many)).toHaveLength(MAX_QUESTION_OPTIONS);
  });
  it("boş metin boş dizi verir", () => {
    expect(parseOptionsDraft("")).toEqual([]);
    expect(parseOptionsDraft("\n\n")).toEqual([]);
  });
});

/* "Zorunlu" işareti çoktan seçmelide dışa aktarılan HTML'de sessizce yok
   sayılıyordu (multi dalında `required` hiç basılmıyordu). Naif çözüm — her
   checkbox'a `required` koymak — HEPSİNİN işaretlenmesini şart koşardı; bu
   yüzden "en az bir" kuralı JS ile uygulanıyor. */
describe("formToHtml — zorunlu çoktan seçmeli", () => {
  const form = (required: boolean) => ({
    id: "f1", title: "T", createdAt: 1, updatedAt: 1,
    questions: [{ id: "q1", type: "multi" as const, label: "Hangileri?", options: ["A", "B"], required }],
  });

  it("checkbox'lara HTML required BASILMAZ (hepsini zorunlu kılardı)", () => {
    const html = formToHtml(form(true));
    const boxes = html.match(/<input type="checkbox"[^>]*>/g) ?? [];
    expect(boxes.length).toBe(2);
    expect(boxes.every((b) => !/\brequired\b/.test(b))).toBe(true);
  });

  it("zorunlu multi sorusunun indeksi REQUIRED_MULTI'ye yazılır", () => {
    expect(formToHtml(form(true))).toMatch(/var REQUIRED_MULTI = \[0\]/);
  });

  it("zorunlu DEĞİLSE listeye girmez", () => {
    expect(formToHtml(form(false))).toMatch(/var REQUIRED_MULTI = \[\]/);
  });

  it("en-az-bir doğrulaması setCustomValidity ile bağlanır", () => {
    const html = formToHtml(form(true));
    expect(html).toContain("syncMultiValidity");
    expect(html).toContain("setCustomValidity");
    expect(html).toContain("En az bir seçenek seç.");
  });

  it("zorunlu işareti (*) etikette görünmeye devam eder", () => {
    expect(formToHtml(form(true))).toContain('<em title="Zorunlu">*</em>');
  });
});
