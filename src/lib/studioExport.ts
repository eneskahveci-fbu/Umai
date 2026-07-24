/* Stüdyo artifact dışa aktarma — üretilen HTML için (kod-tabanlı tasarımlar).
   Klasik DesignStudio'nun katman/canvas PNG export'undan ayrı; burada tam HTML
   belgesi indirilir / yazdırılır / yeni sekmede açılır. */

import { buildStandaloneSandboxDoc } from "./artifactDoc";

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

/** HTML'i yeni sekmede aç (önizleme/paylaşım için geçici blob).
    NOT: blob: URL'ler OLUŞTURAN sayfanın origin'ini miras alır — untrusted
    (LLM üretimi) html'i çıplak blob'a koymak, içindeki script'e gerçek
    uygulama origin'ini (çerezler/localStorage/service worker) verirdi.
    buildStandaloneSandboxDoc dış kabuğu script'siz tutup asıl içeriği
    allow-same-origin'siz sandbox'lı bir iframe'e gömer (bkz. artifactDoc.ts). */
export function openInTab(html: string): boolean {
  const blob = new Blob([buildStandaloneSandboxDoc(html)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return !!w;
}

/** İçeriği /api/publish ile paylaşılabilir bağlantıya çevirir, panoya kopyalar.
    Başarısızlıkta null döner; toast metni çağırana bırakılır. Varsayılan tür
    "html"; Kroki gibi SVG yüzeyler "svg" geçer (/a/<id> ikisini de işler). */
export async function publishArtifact(title: string, content: string, type: "html" | "svg" = "html"): Promise<string | null> {
  try {
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "umai", type, content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) return null;
    const url = `${window.location.origin}/a/${data.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* yok say */ }
    return url;
  } catch {
    return null;
  }
}

/** Yazdır panelini açarak PDF'e aktar (tarayıcı "PDF olarak kaydet").
    NOT: `w` bilerek `noopener` OLMADAN açılıyor (document.write ile yazmak için
    referansa ihtiyaç var) — ama bu, untrusted (LLM üretimi) html'i doğrudan
    aynı-origin pencereye yazmak GÜVENLİ demek değil: w, about:blank olduğundan
    açan sayfanın origin'ini miras alır ve `w.opener` üzerinden gerçek uygulama
    penceresine erişebilir. Bu yüzden ham html DEĞİL, buildStandaloneSandboxDoc'un
    ürettiği sarmalayıcı yazılıyor — untrusted içerik yalnız allow-same-origin'siz
    (opak origin) bir iframe'in içinde çalışıyor, `w.opener`'a hiç erişemiyor.
    Yazdırma tetikleyicisi de sarmalayıcının KENDİ (güvenilir) script'i. */
export function printPdf(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(buildStandaloneSandboxDoc(html, true));
  w.document.close();
  return true;
}

/** Sunum (deck) PDF dışa aktarımı — printPdf()'ten KASITLI olarak farklı bir
    yol izler. deckToHtml() çıktısı (slides.ts) LLM'in serbest HTML'i DEĞİL,
    kendi ürettiğimiz deterministik şablondur: tüm kullanıcı metni escapeHtml
    ile kaçırılmış, tek script bloğu bizim yazdığımız slayt-gezinme koduzdur
    — LLM script'i hiç yok. Bu yüzden printPdf()'in allow-same-origin'siz
    sandbox iframe'ine ihtiyacı yok.

    Bunun tek "iyi niyet" fedakârlığı değil: ampirik olarak doğrulandı
    (Playwright + gerçek Chromium, page.pdf) — deste HTML'i nested sandbox
    iframe İÇİNDEYKEN "@media print" sayfa-sonu (page-break-after) kuralları
    PDF çıktısında ÇALIŞMIYOR, tüm slaytlar TEK sayfaya sıkışıyor; belge
    DOĞRUDAN üst seviye yazılınca (bu fonksiyon) tarayıcının normal çok-sayfa
    yazdırma motoru sorunsuz devreye giriyor. */
export function printDeckPdf(deckHtml: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const withAutoPrint = deckHtml.includes("</body>")
    ? deckHtml.replace("</body>", `<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body>`)
    : `${deckHtml}<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>`;
  w.document.open();
  w.document.write(withAutoPrint);
  w.document.close();
  return true;
}
