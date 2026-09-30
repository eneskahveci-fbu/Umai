import { result } from "../lib.mjs";

export const id = "bizplan";
export const title = "İş planı / pazar raporu (sayısal tutarlılık)";
export const category = "Analiz";

export const prompt = `İstanbul'da "mobil oto yıkama aboneliği" fikri için yatırımcıya sunulacak kısa bir iş planı raporu yaz (Türkçe, Markdown).

Zorunlu bölüm başlıkları (## ile, tam bu adlarla): Özet, Pazar ve Hedef Kitle, Rakipler, Gelir Modeli, 12 Aylık Projeksiyon, Riskler, Sonuç.

"12 Aylık Projeksiyon" bölümünde şu varsayımlarla bir Markdown TABLOSU ver. Sütunlar tam olarak: Ay | Müşteri | Gelir | Gider | Kâr
Varsayımlar:
- 1. ay müşteri sayısı 200; her ay net %8 büyür (müşteri[t+1] = müşteri[t] × 1,08); müşteri sayısını her ay en yakın tam sayıya yuvarla ve SONRAKİ ayı yuvarlanmış değerden değil, yuvarlanmamış seri üzerinden hesapla (200 × 1,08^(ay-1) → sonra yuvarla).
- Abonelik ücreti aylık 349 TL/müşteri → Gelir = Müşteri × 349.
- Değişken maliyet 140 TL/müşteri, sabit gider 85000 TL/ay → Gider = Müşteri × 140 + 85000.
- Kâr = Gelir − Gider.
- Sayıları binlik ayraçsız, tam sayı olarak yaz (örn. 69800).
Tablodan sonra, kümülatif kâr ilk kez pozitife geçtiği "başa baş ayı"nı (başlangıç yatırımı 600000 TL'yi çıkardıktan sonra) tek cümlede belirt; başa baş 12 ay içinde olmuyorsa "12 ay içinde ulaşılamıyor" yaz.`;

function projection() {
  const rows = [];
  let cum = -600000, breakEven = null;
  for (let m = 1; m <= 12; m++) {
    const c = Math.round(200 * 1.08 ** (m - 1));
    const rev = c * 349, cost = c * 140 + 85000, profit = rev - cost;
    cum += profit;
    if (breakEven === null && cum > 0) breakEven = m;
    rows.push({ m, c, rev, cost, profit });
  }
  return { rows, breakEven };
}
export const EXPECT = projection();

export async function check(answer) {
  const notes = [];
  let ok = 0, total = 0;
  const t = (cond, msg) => { total++; if (cond) ok++; else notes.push(msg); };
  const heads = ["Özet", "Pazar ve Hedef Kitle", "Rakipler", "Gelir Modeli", "12 Aylık Projeksiyon", "Riskler", "Sonuç"];
  for (const h of heads) t(new RegExp(`^##\\s*${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im").test(answer), `Başlık eksik: ## ${h}`);
  const rows = [];
  for (const line of answer.split("\n")) {
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 5 && /^\d{1,2}$/.test(cells[0])) rows.push(cells.slice(0, 5).map((c) => Number(c.replace(/[^\d-]/g, ""))));
  }
  t(rows.length === 12, `Tabloda 12 satır olmalı (bulunan: ${rows.length})`);
  let wrongCells = 0;
  for (const e of EXPECT.rows) {
    const r = rows.find((x) => x[0] === e.m);
    if (!r) { wrongCells += 4; continue; }
    const within = (a, b) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.005);
    if (!within(r[1], e.c)) wrongCells++;
    if (!within(r[2], e.rev)) wrongCells++;
    if (!within(r[3], e.cost)) wrongCells++;
    if (!within(r[4], e.profit)) wrongCells++;
  }
  t(wrongCells === 0, `Tabloda ${wrongCells} hücre yanlış (12. ay beklenen: müşteri ${EXPECT.rows[11].c}, kâr ${EXPECT.rows[11].profit})`);
  const be = EXPECT.breakEven;
  const beOk = be === null ? /ulaşılamıyor/i.test(answer) : new RegExp(`\\b${be}\\.?\\s*(ay|\\.\\s*ay)`, "i").test(answer.split(/başa\s*baş/i).slice(1).join(" "));
  t(beOk, `Başa baş ayı yanlış/yok (beklenen: ${be ?? "ulaşılamıyor"})`);
  return result(ok === total, ok / total, notes);
}

function refTable() {
  const lines = ["| Ay | Müşteri | Gelir | Gider | Kâr |", "|---|---|---|---|---|"];
  for (const e of EXPECT.rows) lines.push(`| ${e.m} | ${e.c} | ${e.rev} | ${e.cost} | ${e.profit} |`);
  return lines.join("\n");
}
export const reference = ["Özet", "Pazar ve Hedef Kitle", "Rakipler", "Gelir Modeli"].map((h) => `## ${h}\nMetin.`).join("\n\n") + `\n\n## 12 Aylık Projeksiyon\n${refTable()}\n\n${EXPECT.breakEven === null ? "Başa baş 12 ay içinde ulaşılamıyor." : `Başa baş ${EXPECT.breakEven}. ay.`}\n\n## Riskler\nMetin.\n\n## Sonuç\nMetin.`;
export const wrong = "## Özet\nGüzel fikir.\n\n## Sonuç\nYatırım yapın.";
