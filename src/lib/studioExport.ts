/* Stüdyo artifact dışa aktarma — üretilen HTML için (kod-tabanlı tasarımlar).
   Klasik DesignStudio'nun katman/canvas PNG export'undan ayrı; burada tam HTML
   belgesi indirilir / yazdırılır / yeni sekmede açılır. */

function slug(title: string): string {
  return (title || "tasarim").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "tasarim";
}

/** Tam HTML belgesini .html dosyası olarak indir. */
export function downloadHtml(html: string, title: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(title)}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** HTML'i yeni sekmede aç (önizleme/paylaşım için geçici blob). */
export function openInTab(html: string): boolean {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return !!w;
}

/** Yazdır panelini açarak PDF'e aktar (tarayıcı "PDF olarak kaydet"). */
export function printPdf(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  /* Yüklendikten sonra otomatik yazdır → kullanıcı "PDF olarak kaydet" seçer. */
  const withPrint = html.includes("</body>")
    ? html.replace("</body>", "<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body>")
    : html + "<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>";
  w.document.open();
  w.document.write(withPrint);
  w.document.close();
  return true;
}
