/* İstemci-taraflı Office (OOXML) metin çıkarımı — .docx / .xlsx / .pptx.
   pdf.ts ile aynı sözleşme: dosyayı TARAYICIDA işler, düz metin döndürür,
   hiçbir veri sunucuya gitmez.

   Bağımlılık YOK: üç format da aslında birer ZIP arşivi (OOXML) ve tarayıcının
   yerleşik DecompressionStream("deflate-raw") API'siyle açılabiliyor. Bu, kod
   tabanının mevcut tercihiyle uyumlu (kendi ayrıştırıcısını yazmak, ~1MB'lık
   jszip/mammoth/xlsx paketleri eklememek). */

/* ── Küçük ZIP okuyucu ───────────────────────────────────────────────────
   Merkezi dizin (central directory) üzerinden okur — yerel başlıklar veri
   tanımlayıcısı (data descriptor) kullandığında boyut alanları sıfır
   olabildiği için tek güvenilir yol budur. */

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ZIP arşivindeki dosyaları {yol → içerik} olarak çözer. Yalnızca `want`
    koşuluna uyan girdiler açılır (gereksiz inflate maliyeti olmasın). */
export async function unzip(buf: ArrayBuffer, want: (path: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const out = new Map<string, string>();

  /* EOCD'yi sondan geriye tara (yorum alanı en fazla 64KB olabilir). */
  let eocd = -1;
  const minStart = Math.max(0, buf.byteLength - 65_557);
  for (let i = buf.byteLength - 22; i >= minStart; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Geçersiz arşiv (ZIP sonu bulunamadı)");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true); // merkezi dizin başlangıcı
  const dec = new TextDecoder();

  for (let n = 0; n < count && ptr + 46 <= buf.byteLength; n++) {
    if (view.getUint32(ptr, true) !== SIG_CENTRAL) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOff = view.getUint32(ptr + 42, true);
    const name = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (!want(name)) continue;
    /* Yerel başlıktan gerçek veri konumunu bul (ad/extra uzunlukları burada
       merkezi dizindekinden FARKLI olabilir — spec buna izin veriyor). */
    if (localOff + 30 > buf.byteLength) continue;
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);
    try {
      const data = method === 0 ? raw : await inflateRaw(raw);
      out.set(name, dec.decode(data));
    } catch { /* bozuk girdi — atla, diğerleri okunmaya devam etsin */ }
  }
  return out;
}

/* ── XML → düz metin yardımcıları ──────────────────────────────────────── */

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // &amp; EN SONDA — aksi halde &amp;lt; iki kez çözülürdü
}

/** Verilen etiketin (ör. "w:t") içindeki metinleri sırayla toplar. */
function tagTexts(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXmlEntities(m[1]));
  return out;
}

/* ── docx ──────────────────────────────────────────────────────────────── */

/** Word belgesinin gövdesini paragraf paragraf düz metne çevirir. */
export function docxXmlToText(xml: string): string {
  /* Paragrafları ayır; her paragrafın içindeki <w:t> parçalarını birleştir.
     <w:tab/> → sekme, <w:br/> → satır sonu. */
  const paras = xml.split(/<w:p(?:\s[^>]*)?>/).slice(1);
  const lines = paras.map((p) => {
    const body = p.split("</w:p>")[0] ?? "";
    return tagTexts(body.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n"), "w:t").join("");
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── xlsx ──────────────────────────────────────────────────────────────── */

/** Paylaşılan dizgi tablosu (xl/sharedStrings.xml) → dizi. */
export function parseSharedStrings(xml: string): string[] {
  const items = xml.split(/<si(?:\s[^>]*)?>/).slice(1);
  return items.map((si) => tagTexts(si.split("</si>")[0] ?? "", "t").join(""));
}

/** Bir çalışma sayfasını (sheetN.xml) satır satır TSV'ye çevirir. */
export function sheetXmlToText(xml: string, shared: string[]): string {
  const rows = xml.split(/<row(?:\s[^>]*)?>/).slice(1);
  const lines: string[] = [];
  for (const r of rows) {
    const body = r.split("</row>")[0] ?? "";
    const cells: string[] = [];
    const cellRe = /<c(\s[^>]*)?>([\s\S]*?)<\/c>|<c(\s[^>]*)\/>/g;
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(body))) {
      const attrs = m[1] ?? m[3] ?? "";
      const inner = m[2] ?? "";
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      let val: string;
      if (type === "s") {
        const idx = Number(tagTexts(inner, "v")[0] ?? "");
        val = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
      } else if (type === "inlineStr") {
        val = tagTexts(inner, "t").join("");
      } else {
        val = tagTexts(inner, "v")[0] ?? "";
      }
      cells.push(val);
    }
    if (cells.some((c) => c !== "")) lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

/* ── pptx ──────────────────────────────────────────────────────────────── */

/** Bir slaytın (slideN.xml) metin kutularını düz metne çevirir. */
export function slideXmlToText(xml: string): string {
  return tagTexts(xml, "a:t").join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── Genel giriş noktası ───────────────────────────────────────────────── */

const MAX_CHARS = 200_000; // çok büyük belgeler prompt'u boğmasın

/** Uzantıya göre .docx/.xlsx/.pptx dosyasından düz metin çıkarır.
    Desteklenmeyen uzantıda hata fırlatır. */
export async function extractOfficeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();

  if (name.endsWith(".docx")) {
    const files = await unzip(buf, (p) => p === "word/document.xml");
    const xml = files.get("word/document.xml");
    if (!xml) throw new Error("Word belgesi okunamadı (word/document.xml yok)");
    return docxXmlToText(xml).slice(0, MAX_CHARS);
  }

  if (name.endsWith(".xlsx")) {
    const files = await unzip(buf, (p) => p === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(p));
    const shared = parseSharedStrings(files.get("xl/sharedStrings.xml") ?? "");
    const sheets = [...files.keys()]
      .filter((p) => p.startsWith("xl/worksheets/"))
      .sort((a, b) => (Number(/(\d+)/.exec(a)?.[1] ?? 0) - Number(/(\d+)/.exec(b)?.[1] ?? 0)));
    if (!sheets.length) throw new Error("Excel dosyasında çalışma sayfası bulunamadı");
    const parts = sheets.map((p, i) => {
      const text = sheetXmlToText(files.get(p) ?? "", shared);
      return text ? `--- Sayfa ${i + 1} ---\n${text}` : "";
    }).filter(Boolean);
    return parts.join("\n\n").slice(0, MAX_CHARS);
  }

  if (name.endsWith(".pptx")) {
    const files = await unzip(buf, (p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
    const slides = [...files.keys()]
      .sort((a, b) => (Number(/(\d+)/.exec(a)?.[1] ?? 0) - Number(/(\d+)/.exec(b)?.[1] ?? 0)));
    if (!slides.length) throw new Error("Sunumda slayt bulunamadı");
    const parts = slides.map((p, i) => {
      const text = slideXmlToText(files.get(p) ?? "");
      return text ? `--- Slayt ${i + 1} ---\n${text}` : "";
    }).filter(Boolean);
    return parts.join("\n\n").slice(0, MAX_CHARS);
  }

  throw new Error("Desteklenmeyen Office dosyası");
}

/** Dosya adı Office (OOXML) formatlarından biri mi? */
export function isOfficeFile(name: string): boolean {
  return /\.(docx|xlsx|pptx)$/i.test(name);
}
