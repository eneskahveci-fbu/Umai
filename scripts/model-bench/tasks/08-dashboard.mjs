import { extractCode, withPage, result } from "../lib.mjs";

export const id = "dashboard";
export const title = "Veriden dashboard (tek dosya HTML + grafik)";
export const category = "İş";

const ROWS = [
  ["2024-01", "Marmara", "Yazılım", 120000, 40], ["2024-01", "Ege", "Yazılım", 80000, 25], ["2024-01", "İç Anadolu", "Donanım", 60000, 12],
  ["2024-02", "Marmara", "Donanım", 150000, 30], ["2024-02", "Ege", "Yazılım", 95000, 31], ["2024-02", "İç Anadolu", "Yazılım", 70000, 22],
  ["2024-03", "Marmara", "Yazılım", 170000, 55], ["2024-03", "Ege", "Donanım", 50000, 9], ["2024-03", "İç Anadolu", "Donanım", 65000, 14],
  ["2024-04", "Marmara", "Donanım", 140000, 28], ["2024-04", "Ege", "Yazılım", 105000, 34], ["2024-04", "İç Anadolu", "Yazılım", 82000, 27],
];
const CSV = ["ay,bolge,urun,gelir,adet", ...ROWS.map((r) => r.join(","))].join("\n");
const TOTAL = ROWS.reduce((s, r) => s + r[3], 0);
const byRegion = {};
for (const r of ROWS) byRegion[r[1]] = (byRegion[r[1]] ?? 0) + r[3];
const TOP = Object.entries(byRegion).sort((a, b) => b[1] - a[1])[0][0];

export const prompt = `Aşağıdaki satış verisinden tek dosyalık (HARİCİ kütüphane/CDN YOK; grafikleri inline SVG veya <canvas> ile kendin çiz) bir HTML dashboard üret. Veriyi JS içine göm ve hesaplamaları JS ile yap. Cevapta yalnız tek bir \`\`\`html bloğu olsun.

Zorunlu öğeler (otomatik test bu seçicilerle çalışır):
- #total-revenue : toplam geliri yalnız rakam ve isteğe bağlı binlik ayraç/para simgesiyle göster (örn. 1.187.000 ₺).
- #top-region : toplam geliri en yüksek bölgenin ADI (yalnız ad).
- #monthly-chart : aylık toplam geliri gösteren bir grafik (içinde svg veya canvas bulunsun).
- table#data : verinin tüm satırlarını (başlık hariç) gösteren tablo, satırlar tbody > tr.
- Konsolda hata olmasın; okunaklı, düzenli tasarım.

VERİ (CSV):
${CSV}`;

export async function check(answer) {
  const html = extractCode(answer, ["html"]);
  const notes = [];
  let ok = 0, total = 0;
  const t = (c, m) => { total++; if (c) ok++; else notes.push(m); };
  try {
    await withPage(html, async (page, errors) => {
      const txt = async (sel) => (await page.locator(sel).first().innerText().catch(() => "")).trim();
      const rev = (await txt("#total-revenue")).replace(/[^\d]/g, "");
      t(rev === String(TOTAL), `#total-revenue yanlış (beklenen ${TOTAL}, bulunan "${rev}")`);
      const top = await txt("#top-region");
      t(top.toLowerCase().includes(TOP.toLowerCase()) && top.length <= TOP.length + 4, `#top-region yanlış (beklenen ${TOP}, bulunan "${top}")`);
      t((await page.locator("#monthly-chart svg, #monthly-chart canvas").count()) > 0, "#monthly-chart içinde svg/canvas yok");
      t((await page.locator("table#data tbody tr").count()) === ROWS.length, `table#data ${ROWS.length} satır göstermeli`);
      t(errors.length === 0, `Konsol/ağ hatası: ${errors.slice(0, 2).join(" | ")}`);
    });
  } catch (e) { return result(false, ok / Math.max(total, 1), [...notes, `Test hatası: ${e.message.split("\n")[0]}`]); }
  return result(ok === total, ok / total, notes);
}

const REF_ROWS = JSON.stringify(ROWS);
export const reference = "```html\n" + `<!doctype html><html><head><meta charset="utf-8"><title>Panel</title></head><body>
<h1 id="total-revenue"></h1><h2 id="top-region"></h2><div id="monthly-chart"></div>
<table id="data"><thead><tr><th>Ay</th><th>Bölge</th><th>Ürün</th><th>Gelir</th><th>Adet</th></tr></thead><tbody></tbody></table>
<script>
const rows = ${REF_ROWS};
document.getElementById("total-revenue").textContent = rows.reduce((s, r) => s + r[3], 0).toLocaleString("tr-TR") + " ₺";
const reg = {}; rows.forEach(r => reg[r[1]] = (reg[r[1]] || 0) + r[3]);
document.getElementById("top-region").textContent = Object.entries(reg).sort((a, b) => b[1] - a[1])[0][0];
const mon = {}; rows.forEach(r => mon[r[0]] = (mon[r[0]] || 0) + r[3]);
const max = Math.max(...Object.values(mon));
document.getElementById("monthly-chart").innerHTML = '<svg width="400" height="120">' + Object.entries(mon).map(([k, v], i) => '<rect x="' + (i * 90 + 10) + '" y="' + (110 - v / max * 100) + '" width="60" height="' + (v / max * 100) + '" fill="#3b82f6"></rect>').join("") + '</svg>';
document.querySelector("#data tbody").innerHTML = rows.map(r => "<tr>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>").join("");
</script></body></html>` + "\n```";
export const wrong = "```html\n<html><body><h1>Panel</h1></body></html>\n```";
