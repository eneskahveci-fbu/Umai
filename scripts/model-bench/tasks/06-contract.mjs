import { extractJson, result } from "../lib.mjs";

export const id = "contract";
export const title = "Sözleşme incelemesi (riskli maddeleri bul)";
export const category = "Analiz";

const CLAUSES = [
  ["Taraflar", "İşbu sözleşme Alfa Yazılım Ltd. (\"Yüklenici\") ile Beta Perakende A.Ş. (\"Müşteri\") arasında akdedilmiştir."],
  ["Konu", "Yüklenici, Müşteri'nin e-ticaret platformunun geliştirilmesi ve bakımını ekte tanımlanan kapsamda yürütecektir."],
  ["Bedel", "Toplam hizmet bedeli KDV hariç 900.000 TL'dir ve üç eşit taksitte, fatura tarihinden itibaren 30 gün içinde ödenir."],
  ["Süre", "Sözleşme imza tarihinde başlar ve 12 ay sürer. Süre sonunda taraflardan biri 30 gün önceden yazılı bildirimde bulunmadıkça sözleşme 5 yıl süreyle kendiliğinden yenilenir ve erken fesih halinde kalan dönem bedelinin %300'ü cezai şart olarak ödenir."],
  ["Fesih", "Müşteri, herhangi bir gerekçe göstermeksizin ve önceden bildirimde bulunmaksızın sözleşmeyi tek taraflı olarak dilediği an feshedebilir; Yüklenici'nin bu yönde bir fesih hakkı yoktur ve o ana kadar yapılan işler için ödeme talep edemez."],
  ["Gizlilik", "Taraflar, sözleşme kapsamında öğrendikleri ticari sırları üçüncü kişilerle paylaşmayacaktır. Bu yükümlülük sözleşme bitiminden sonra 2 yıl devam eder."],
  ["Sorumluluk", "Yüklenici, hizmetten kaynaklanan doğrudan ve dolaylı, öngörülebilir veya öngörülemez TÜM zararlardan, kâr kaybı dahil ve herhangi bir üst sınır olmaksızın sınırsız olarak sorumludur."],
  ["Fikri mülkiyet", "Yüklenici'nin sözleşme öncesinde sahip olduğu tüm yazılım, kütüphane ve yöntemler dahil olmak üzere, sözleşme süresince kullanılan veya geliştirilen tüm fikri haklar bedelsiz ve süresiz olarak Müşteri'ye devredilmiş sayılır."],
  ["Teslim", "Teslimat aşamaları ekteki iş planında yer alır; gecikmeler yazılı olarak bildirilir."],
  ["Bakım", "Teslimden sonraki 6 ay boyunca kritik hatalar 48 saat içinde giderilir."],
  ["Mücbir sebep", "Tarafların kontrolü dışındaki olaylar nedeniyle yükümlülüklerin ifasındaki gecikmelerden taraflar sorumlu tutulamaz."],
  ["Bildirimler", "Tüm bildirimler sözleşmede yazılı adreslere iadeli taahhütlü posta veya e-posta ile yapılır."],
  ["Uyuşmazlık", "Uyuşmazlıklarda Londra mahkemeleri ve icra daireleri yetkilidir; Yüklenici, Türk mahkemelerine ve tüketici/ticari koruma hükümlerine başvuru hakkından peşinen feragat etmiştir."],
  ["Yürürlük", "İşbu sözleşme iki nüsha olarak düzenlenmiş ve imzalanmıştır."],
];
// Riskli maddeler (1 tabanlı): Süre=4, Fesih=5, Sorumluluk=7, Fikri mülkiyet=8, Uyuşmazlık=13
export const RISKY = new Set([4, 5, 7, 8, 13]);
const DOC = CLAUSES.map(([h, t], i) => `Madde ${i + 1} — ${h}: ${t}`).join("\n\n");

export const prompt = `Sen Yüklenici (Alfa Yazılım) tarafını temsil eden bir avukatsın. Aşağıdaki sözleşmede Yüklenici için ciddi RİSK taşıyan maddeleri bul. Sıradan/dengeli maddeleri işaretleme (gereksiz alarm de bir hatadır).

Çıktı: yalnız geçerli bir JSON dizisi:
[{"madde": <madde numarası>, "risk": "neden riskli, 1-2 cümle", "oneri": "önerilen değişiklik"}]

SÖZLEŞME:
${DOC}`;

export async function check(answer) {
  let arr;
  try { arr = extractJson(answer); } catch (e) { return result(false, 0, [`JSON okunamadı: ${e.message}`]); }
  if (!Array.isArray(arr)) return result(false, 0, ["Çıktı bir dizi olmalı"]);
  const flagged = new Set(arr.map((x) => Number(x.madde)).filter(Number.isFinite));
  const tp = [...flagged].filter((n) => RISKY.has(n)).length;
  const recall = tp / RISKY.size;
  const precision = flagged.size ? tp / flagged.size : 0;
  const missed = [...RISKY].filter((n) => !flagged.has(n));
  const extra = [...flagged].filter((n) => !RISKY.has(n));
  const notes = [];
  if (missed.length) notes.push(`Kaçırılan riskli madde(ler): ${missed.join(", ")}`);
  if (extra.length) notes.push(`Gereksiz alarm: madde ${extra.join(", ")}`);
  if (arr.some((x) => !x.risk || String(x.risk).length < 10)) notes.push("Bazı maddelerde gerekçe yok/çok kısa");
  const f1 = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
  return result(recall >= 0.8 && precision >= 0.6 && notes.every((n) => !n.startsWith("Bazı")), f1, notes);
}

export const reference = JSON.stringify([4, 5, 7, 8, 13].map((m) => ({ madde: m, risk: "Yüklenici aleyhine aşırı/tek taraflı hüküm taşıyor.", oneri: "Dengeli hale getirilmeli." })));
export const wrong = JSON.stringify([{ madde: 1, risk: "Taraflar bölümü belirsiz olabilir.", oneri: "yok" }, { madde: 3, risk: "Bedel yüksek görünüyor.", oneri: "düşür" }]);
