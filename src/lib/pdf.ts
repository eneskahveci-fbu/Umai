/* İstemci-taraflı PDF metin çıkarımı (pdf.js).
 * Görsel-ekleme akışıyla aynı mantık: dosyayı tarayıcıda işler, metni döndürür;
 * hiçbir veri sunucuya gitmez. Worker, bundler tarafından paketlenir (self-host). */
import type { TextItem } from "pdfjs-dist/types/src/display/api";

let workerSet = false;

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerSet) {
    /* Worker'ı paket içinden yükle (CDN gerektirmez, ücretsiz/self-host). */
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    workerSet = true;
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const parts: string[] = [];
  const maxPages = Math.min(doc.numPages, 50); // aşırı uzun PDF'leri sınırla
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as TextItem).str : ""))
      .join(" ")
      .replace(/\s+\n/g, "\n")
      .trim();
    if (text) parts.push(`--- Sayfa ${i} ---\n${text}`);
  }
  await doc.cleanup();
  let out = parts.join("\n\n");
  if (doc.numPages > maxPages) out += `\n\n[Not: ${doc.numPages} sayfadan ilk ${maxPages}'i okundu.]`;
  return out || "(PDF'den metin çıkarılamadı — taranmış/görsel PDF olabilir.)";
}
