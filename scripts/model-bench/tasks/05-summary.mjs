import { extractJson, result } from "../lib.mjs";

export const id = "summary";
export const title = "Uzun belge özeti + soru-cevap (uydurma tuzaklı)";
export const category = "Analiz";

/* Deterministik sentetik yıllık rapor: dolgu paragraflar + yerleştirilmiş gerçekler. */
function buildDoc() {
  const fill = [
    "Yönetim kurulu, dönem boyunca operasyonel verimliliği artırmaya yönelik çalışmalarını sürdürmüş; süreçlerin dijitalleşmesi ve raporlama altyapısının güçlendirilmesi öncelikli gündem maddeleri olmuştur.",
    "Tedarik zinciri tarafında birden fazla alt yükleniciyle yürütülen görüşmeler, hizmet seviyesi anlaşmalarının güncellenmesiyle sonuçlanmış ve teslimat sürelerinde istikrar sağlanmıştır.",
    "İnsan kaynakları politikaları kapsamında eğitim programları genişletilmiş, çalışan memnuniyeti anketlerinde katılım oranı önceki döneme göre artış göstermiştir.",
    "Kurumsal risk yönetimi çerçevesi gözden geçirilmiş, iç denetim bulguları ilgili birimlerle paylaşılarak aksiyon planlarına bağlanmıştır.",
    "Sürdürülebilirlik alanında enerji tüketiminin izlenmesi ve atık yönetiminin iyileştirilmesi yönünde pilot uygulamalar başlatılmıştır.",
  ];
  const facts = {
    1: "Şirketin 2024 yılı konsolide net satış geliri 482,7 milyon TL olarak gerçekleşmiş, bu rakam bir önceki yıla göre %18,4 artışa karşılık gelmektedir.",
    2: "Yıl sonu itibarıyla filo büyüklüğü 1.240 araca ulaşmıştır; bunların 310'u elektrikli veya hibrit araçlardan oluşmaktadır.",
    3: "Trabzon Limanı'ndaki yeni aktarma merkezi 14 Mart 2025 tarihinde hizmete açılmıştır.",
    4: "Genel Müdür Selin Aksoy, 2025 hedefi olarak Orta Asya hattında 3 yeni sefer güzergâhı açılacağını duyurmuştur.",
    5: "Soğuk zincir segmenti, artan enerji maliyetleri nedeniyle 21,3 milyon TL zarar yazmıştır.",
    6: "Müşteri memnuniyet skoru (NPS) 61 olarak ölçülmüştür.",
  };
  const sections = [];
  for (let i = 1; i <= 12; i++) {
    const paras = [];
    for (let k = 0; k < 5; k++) paras.push(fill[(i + k) % fill.length] + " " + fill[(i * 3 + k + 1) % fill.length]);
    if (facts[i]) paras.splice(2, 0, facts[i]);
    sections.push(`## Bölüm ${i}\n\n${paras.join("\n\n")}`);
  }
  return `# Karadeniz Lojistik A.Ş. — 2024 Faaliyet Raporu\n\n${sections.join("\n\n")}`;
}
export const DOC = buildDoc();

export const prompt = `Aşağıdaki faaliyet raporunu oku. SADECE belgedeki bilgilere dayan; belgede olmayan bilgiyi ASLA uydurma.

Çıktı: yalnız geçerli bir JSON nesnesi (başka metin yok):
{
  "ozet": "en fazla 120 kelimelik Türkçe özet (belgede geçmeyen sayı/isim kullanma)",
  "cevaplar": {
    "gelir": "2024 net satış geliri ve büyüme oranı nedir?",
    "filo": "Yıl sonu filo büyüklüğü ve elektrikli/hibrit araç sayısı?",
    "liman": "Trabzon'daki aktarma merkezi ne zaman açıldı?",
    "hedef": "Genel Müdür 2025 için hangi hedefi duyurdu ve genel müdürün adı?",
    "zarar": "Hangi segment zarar yazdı ve ne kadar?",
    "temettu": "2024 hisse başı temettü tutarı nedir? (belgede yoksa tam olarak \\"belirtilmemiş\\" yaz)"
  }
}

BELGE:
${DOC}`;

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ");
const has = (s, ...needles) => needles.every((n) => norm(s).includes(n.toLowerCase()));

export async function check(answer) {
  let j;
  try { j = extractJson(answer); } catch (e) { return result(false, 0, [`JSON okunamadı: ${e.message}`]); }
  const c = j.cevaplar ?? {};
  const notes = [];
  let ok = 0; const total = 8;
  const t = (cond, msg) => { if (cond) ok++; else notes.push(msg); };
  t(has(c.gelir, "482,7") && has(c.gelir, "18,4"), "gelir cevabı yanlış (482,7 milyon TL, %18,4)");
  t(/1[.,]?240/.test(String(c.filo)) && /310/.test(String(c.filo)), "filo cevabı yanlış (1.240 / 310)");
  t(has(c.liman, "14 mart 2025") || (has(c.liman, "14") && /mart/i.test(String(c.liman)) && /2025/.test(String(c.liman))), "liman tarihi yanlış (14 Mart 2025)");
  t(has(c.hedef, "selin aksoy") && /3/.test(String(c.hedef)) && /orta asya/i.test(String(c.hedef)), "hedef cevabı yanlış (Selin Aksoy, Orta Asya, 3 güzergâh)");
  t(/soğuk zincir/i.test(String(c.zarar)) && /21[.,]3/.test(String(c.zarar)), "zarar cevabı yanlış (soğuk zincir 21,3 milyon TL)");
  t(/belirtilmemiş/i.test(String(c.temettu)) && !/\d/.test(String(c.temettu).replace(/belirtilmemiş/gi, "")), "temettü UYDURULDU (belgede yok → 'belirtilmemiş')");
  const ozet = String(j.ozet ?? "");
  t(ozet.split(/\s+/).filter(Boolean).length <= 130 && ozet.length > 40, "özet 40+ karakter ve en fazla ~120 kelime olmalı");
  const docNums = new Set((DOC.match(/\d[\d.,]*/g) ?? []).map((x) => x.replace(/[.,]$/, "")));
  const invented = (ozet.match(/\d[\d.,]*/g) ?? []).map((x) => x.replace(/[.,]$/, "")).filter((x) => !docNums.has(x));
  t(invented.length === 0, `özette belgede olmayan sayı(lar): ${invented.join(", ")}`);
  return result(ok === total, ok / total, notes);
}

export const reference = JSON.stringify({
  ozet: "Karadeniz Lojistik 2024'te 482,7 milyon TL net satış geliri elde etti; bu %18,4 artış demektir. Filo 1.240 araca ulaştı, 310'u elektrikli veya hibrit. Trabzon aktarma merkezi 14 Mart 2025'te açıldı. Soğuk zincir segmenti 21,3 milyon TL zarar yazdı. NPS 61 oldu.",
  cevaplar: { gelir: "482,7 milyon TL, %18,4 artış", filo: "1.240 araç, 310 elektrikli/hibrit", liman: "14 Mart 2025", hedef: "Selin Aksoy: Orta Asya'da 3 yeni sefer güzergâhı", zarar: "Soğuk zincir, 21,3 milyon TL", temettu: "belirtilmemiş" },
});
export const wrong = JSON.stringify({ ozet: "Şirket iyi gitti ve 500 milyon TL kazandı.", cevaplar: { gelir: "500 milyon", filo: "1000", liman: "2024", hedef: "?", zarar: "yok", temettu: "2,5 TL" } });
