import { describe, expect, it } from "vitest";
import { lintArtifactByType } from "../studioCraft";

/* N3 — kalite notu artık yalnız html'e özel değil: React önizlemesi, SVG ve
   mermaid çıktıları da denetleniyor. Sözleşme lintArtifact ile aynı: üretimi
   ASLA engellemez, yalnız "şuna bir bak" notu döner. */

describe("lintArtifactByType — html (mevcut davranış korunur)", () => {
  it("AI-klişesi paleti ve lorem ipsum'u yakalar", () => {
    const out = lintArtifactByType("html", "<div style='color:#6366f1'>Lorem ipsum dolor</div>");
    expect(out.join(" ")).toMatch(/indigo\/mor/);
    expect(out.join(" ")).toMatch(/Lorem ipsum/);
  });

  it("temiz html'de uyarı üretmez", () => {
    expect(lintArtifactByType("html", "<div style='color:#123456'>Gerçek içerik</div>")).toEqual([]);
  });
});

describe("lintArtifactByType — SVG", () => {
  it("viewBox eksikse uyarır", () => {
    const out = lintArtifactByType("svg", '<svg width="100" height="100"><title>x</title><rect/></svg>');
    expect(out.join(" ")).toMatch(/viewBox yok/);
  });

  it("viewBox varsa ölçekleme uyarısı vermez", () => {
    const out = lintArtifactByType("svg", '<svg viewBox="0 0 100 100"><title>Grafik</title><rect/></svg>');
    expect(out.join(" ")).not.toMatch(/viewBox yok/);
  });

  it("başlık/aria-label yoksa erişilebilirlik uyarısı verir", () => {
    const out = lintArtifactByType("svg", '<svg viewBox="0 0 10 10"><rect/></svg>');
    expect(out.join(" ")).toMatch(/ekran okuyucular/);
  });

  it("tam donanımlı SVG hiç uyarı üretmez", () => {
    const out = lintArtifactByType("svg", '<svg viewBox="0 0 10 10"><title>Şema</title><rect/></svg>');
    expect(out).toEqual([]);
  });
});

describe("lintArtifactByType — mermaid", () => {
  it("diyagram türü belirtilmemişse uyarır (mermaid render etmez)", () => {
    const out = lintArtifactByType("mermaid", "A --> B\nB --> C");
    expect(out.join(" ")).toMatch(/diyagram türü belirtilmemiş/);
  });

  it("geçerli diyagram türlerini kabul eder", () => {
    for (const head of ["graph TD", "flowchart LR", "sequenceDiagram", "erDiagram", "mindmap"]) {
      expect(lintArtifactByType("mermaid", `${head}\nA --> B`).join(" ")).not.toMatch(/diyagram türü/);
    }
  });

  it("çok uzun diyagramda bölme önerir", () => {
    const long = "graph TD\n" + Array.from({ length: 70 }, (_, i) => `A${i} --> B${i}`).join("\n");
    expect(lintArtifactByType("mermaid", long).join(" ")).toMatch(/parçalara bölmeyi/);
  });

  it("boş içerikte uyarı üretmez (henüz yazılmamış diyagram)", () => {
    expect(lintArtifactByType("mermaid", "")).toEqual([]);
  });
});

describe("lintArtifactByType — React önizlemesi (type html içine sarılı)", () => {
  /* preview.ts React/JSX'i reactDoc() ile type:"html" belgesine sarar ve
     kullanıcının kaynağını işaretli bir script etiketinde tutar. */
  function reactPreview(src: string): string {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head>` +
      `<body><script type="text/plain" id="__src">${src}</script></body></html>`;
  }

  it("key'siz liste render'ını yakalar", () => {
    const out = lintArtifactByType("html", reactPreview("items.map(x => <li>{x}</li>)"));
    expect(out.join(" ")).toMatch(/key prop'u yok/);
  });

  it("key varsa uyarmaz", () => {
    const out = lintArtifactByType("html", reactPreview("items.map(x => <li key={x}>{x}</li>)"));
    expect(out.join(" ")).not.toMatch(/key prop'u yok/);
  });

  it("bağımlılık dizisi olmayan useEffect'i yakalar", () => {
    const out = lintArtifactByType("html", reactPreview("useEffect(() => { setX(1); });"));
    expect(out.join(" ")).toMatch(/bağımlılık dizisi yok/);
  });

  it("bağımlılık dizisi varsa uyarmaz", () => {
    const out = lintArtifactByType("html", reactPreview("useEffect(() => { setX(1); }, [x]);"));
    expect(out.join(" ")).not.toMatch(/bağımlılık dizisi yok/);
  });

  it("alt metinsiz görseli yakalar, alt varsa uyarmaz", () => {
    expect(lintArtifactByType("html", reactPreview('<img src="a.png" />')).join(" ")).toMatch(/alt metni/);
    expect(lintArtifactByType("html", reactPreview('<img src="a.png" alt="kedi" />')).join(" ")).not.toMatch(/alt metni/);
  });

  it("React önizlemesinde sarmalayıcı belge denetimi de sürer (iki lint birlikte)", () => {
    const out = lintArtifactByType("html", reactPreview("const c = '#6366f1'; items.map(x => <li>{x}</li>)"));
    expect(out.join(" ")).toMatch(/indigo\/mor/);   // sarmalayıcı/html denetimi
    expect(out.join(" ")).toMatch(/key prop'u yok/); // React denetimi
  });
});

describe("lintArtifactByType — bilinmeyen türler", () => {
  it("markdown ve code'da sessiz kalır (kalite öznel, yanlış uyarı verilmez)", () => {
    expect(lintArtifactByType("markdown", "# Başlık\nLorem ipsum")).toEqual([]);
    expect(lintArtifactByType("code", "print('lorem ipsum')")).toEqual([]);
  });

  it("sql ve python'da sessiz kalır (çalıştırılabilir, kalite lint'i yok)", () => {
    expect(lintArtifactByType("sql", "SELECT * FROM x")).toEqual([]);
    expect(lintArtifactByType("python", "print('lorem ipsum')")).toEqual([]);
  });

  it("boş içerikte çökmez", () => {
    expect(lintArtifactByType("html", "")).toEqual([]);
    expect(lintArtifactByType("svg", "")).toEqual([]);
  });
});
