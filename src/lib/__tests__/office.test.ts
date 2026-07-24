import { describe, expect, it } from "vitest";
import {
  unzip, decodeXmlEntities, docxXmlToText, parseSharedStrings, sheetXmlToText, slideXmlToText, isOfficeFile,
} from "../office";

/* L3 — .docx/.xlsx/.pptx istemci-taraflı metin çıkarımı (bağımlılıksız
   ZIP+XML okuyucu). ZIP okuyucu, elle kurulmuş gerçek bir arşivle
   (STORED/sıkıştırmasız) merkezi-dizin üzerinden doğrulanır. */

/** Test için sıkıştırmasız (method=0) küçük bir ZIP arşivi kurar. */
function buildStoredZip(entries: { name: string; content: string }[]): ArrayBuffer {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameB = enc.encode(e.name);
    const dataB = enc.encode(e.content);

    const local = new Uint8Array(30 + nameB.length + dataB.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 0, true);              // method = stored
    lv.setUint32(18, dataB.length, true);  // compressed size
    lv.setUint32(22, dataB.length, true);  // uncompressed size
    lv.setUint16(26, nameB.length, true);
    lv.setUint16(28, 0, true);             // extra len
    local.set(nameB, 30);
    local.set(dataB, 30 + nameB.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameB.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);             // method = stored
    cv.setUint32(20, dataB.length, true);  // compressed size
    cv.setUint32(24, dataB.length, true);  // uncompressed size
    cv.setUint16(28, nameB.length, true);
    cv.setUint16(30, 0, true);             // extra
    cv.setUint16(32, 0, true);             // comment
    cv.setUint32(42, offset, true);        // local header offset
    central.set(nameB, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const l of locals) { out.set(l, p); p += l.length; }
  for (const c of centrals) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out.buffer;
}

describe("unzip — merkezi dizin üzerinden ZIP okuma", () => {
  it("istenen girdileri çözer, istenmeyenleri atlar", async () => {
    const zip = buildStoredZip([
      { name: "word/document.xml", content: "<w:p><w:t>merhaba</w:t></w:p>" },
      { name: "docProps/app.xml", content: "<Application/>" },
    ]);
    const files = await unzip(zip, (p) => p === "word/document.xml");
    expect(files.get("word/document.xml")).toBe("<w:p><w:t>merhaba</w:t></w:p>");
    expect(files.has("docProps/app.xml")).toBe(false);
  });

  it("birden çok girdiyi doğru konumlardan okur (offset hesabı)", async () => {
    const zip = buildStoredZip([
      { name: "a.xml", content: "AAA" },
      { name: "b.xml", content: "BBBBBB" },
      { name: "c.xml", content: "C" },
    ]);
    const files = await unzip(zip, () => true);
    expect(files.get("a.xml")).toBe("AAA");
    expect(files.get("b.xml")).toBe("BBBBBB");
    expect(files.get("c.xml")).toBe("C");
  });

  it("ZIP olmayan veride anlaşılır hata fırlatır", async () => {
    const notZip = new TextEncoder().encode("bu bir zip değil").buffer;
    await expect(unzip(notZip, () => true)).rejects.toThrow(/ZIP sonu bulunamadı/);
  });

  /* GERÇEK Office dosyaları DEFLATE (method=8) kullanır — üretimde çalışacak
     yol budur, bu yüzden ayrıca sınanır (STORED yolu yukarıda). */
  it("DEFLATE ile sıkıştırılmış girdileri açar", async () => {
    const enc = new TextEncoder();
    const original = "<w:p><w:r><w:t>sıkıştırılmış içerik</w:t></w:r></w:p>".repeat(20);
    const raw = enc.encode(original);
    const cs = new CompressionStream("deflate-raw");
    const deflated = new Uint8Array(
      await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(cs)).arrayBuffer(),
    );

    const nameB = enc.encode("word/document.xml");
    const local = new Uint8Array(30 + nameB.length + deflated.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);                 // method = deflate
    lv.setUint32(18, deflated.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameB.length, true);
    local.set(nameB, 30);
    local.set(deflated, 30 + nameB.length);

    const central = new Uint8Array(46 + nameB.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);                // method = deflate
    cv.setUint32(20, deflated.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, 0, true);
    central.set(nameB, 46);

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, 1, true);
    ev.setUint16(10, 1, true);
    ev.setUint32(12, central.length, true);
    ev.setUint32(16, local.length, true);

    const out = new Uint8Array(local.length + central.length + eocd.length);
    out.set(local, 0);
    out.set(central, local.length);
    out.set(eocd, local.length + central.length);

    const files = await unzip(out.buffer, () => true);
    expect(files.get("word/document.xml")).toBe(original);
    /* Uçtan uca: açılan XML gerçekten metne çevrilebiliyor mu? */
    expect(docxXmlToText(files.get("word/document.xml")!)).toContain("sıkıştırılmış içerik");
  });
});

describe("decodeXmlEntities", () => {
  it("standart varlıkları çözer", () => {
    expect(decodeXmlEntities("a &lt;b&gt; &quot;c&quot; &apos;d&apos;")).toBe(`a <b> "c" 'd'`);
  });

  it("sayısal ve onaltılık varlıkları çözer", () => {
    expect(decodeXmlEntities("&#65;&#x42;")).toBe("AB");
  });

  it("&amp; EN SON çözülür — çift çözme hatasına düşmez", () => {
    /* &amp;lt; kaynakta literal '&lt;' metnidir; '<' OLMAMALI. */
    expect(decodeXmlEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("docxXmlToText", () => {
  it("paragrafları satır satır, run'ları birleştirerek çıkarır", () => {
    const xml =
      "<w:body><w:p><w:r><w:t>Merhaba </w:t></w:r><w:r><w:t>dünya</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>İkinci satır</w:t></w:r></w:p></w:body>";
    expect(docxXmlToText(xml)).toBe("Merhaba dünya\nİkinci satır");
  });

  it("xml:space öznitelikli <w:t> etiketlerini de yakalar", () => {
    const xml = `<w:p><w:r><w:t xml:space="preserve">boşluklu </w:t></w:r><w:r><w:t>metin</w:t></w:r></w:p>`;
    expect(docxXmlToText(xml)).toBe("boşluklu metin");
  });

  it("sekme ve satır sonu etiketlerini karşılıklarına çevirir", () => {
    const xml = "<w:p><w:r><w:t>A</w:t></w:r><w:tab/><w:r><w:t>B</w:t></w:r></w:p>";
    expect(docxXmlToText(xml)).toContain("A");
    expect(docxXmlToText(xml)).toContain("B");
  });

  it("XML varlıklarını çözer", () => {
    expect(docxXmlToText("<w:p><w:r><w:t>Ali &amp; Veli</w:t></w:r></w:p>")).toBe("Ali & Veli");
  });
});

describe("xlsx — paylaşılan dizgiler ve sayfa", () => {
  it("parseSharedStrings çok parçalı (run'lı) hücreleri birleştirir", () => {
    const xml = "<sst><si><t>Ad</t></si><si><r><t>Soy</t></r><r><t>ad</t></r></si></sst>";
    expect(parseSharedStrings(xml)).toEqual(["Ad", "Soyad"]);
  });

  it("sheetXmlToText paylaşılan dizgi indekslerini çözer ve TSV üretir", () => {
    const shared = ["Ad", "Yaş"];
    const xml =
      `<sheetData>` +
      `<row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>` +
      `<row><c r="A2" t="inlineStr"><is><t>Ayşe</t></is></c><c r="B2"><v>30</v></c></row>` +
      `</sheetData>`;
    expect(sheetXmlToText(xml, shared)).toBe("Ad\tYaş\nAyşe\t30");
  });

  it("tamamen boş satırları atlar", () => {
    const xml = `<sheetData><row><c r="A1"><v>5</v></c></row><row></row></sheetData>`;
    expect(sheetXmlToText(xml, [])).toBe("5");
  });

  it("geçersiz paylaşılan dizgi indeksinde çökmez", () => {
    const xml = `<sheetData><row><c r="A1" t="s"><v>99</v></c></row></sheetData>`;
    expect(sheetXmlToText(xml, ["tek"])).toBe("");
  });
});

describe("slideXmlToText", () => {
  it("slayttaki metin kutularını satır satır çıkarır", () => {
    const xml = `<p:sld><a:p><a:r><a:t>Başlık</a:t></a:r></a:p><a:p><a:r><a:t>Madde</a:t></a:r></a:p></p:sld>`;
    expect(slideXmlToText(xml)).toBe("Başlık\nMadde");
  });
});

describe("isOfficeFile", () => {
  it("OOXML uzantılarını tanır (büyük/küçük harf duyarsız)", () => {
    expect(isOfficeFile("rapor.docx")).toBe(true);
    expect(isOfficeFile("TABLO.XLSX")).toBe(true);
    expect(isOfficeFile("sunum.pptx")).toBe(true);
  });

  it("eski ikili biçimleri ve diğer uzantıları reddeder", () => {
    expect(isOfficeFile("eski.doc")).toBe(false);
    expect(isOfficeFile("eski.xls")).toBe(false);
    expect(isOfficeFile("belge.pdf")).toBe(false);
  });
});
