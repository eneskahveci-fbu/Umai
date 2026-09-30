import { result } from "../lib.mjs";

export const id = "translate";
export const title = "Türkçe çeviri/yerelleştirme (terimler + yer tutucular)";
export const category = "İş";

const SRC = `## Release 4.2 notes

We shipped a faster deployment pipeline. Each deployment now finishes in under 90 seconds, and you can trigger a rollback from the dashboard with one click.

- The API now enforces a rate limit of 600 requests per minute per token. Requests above the limit return \`HTTP 429\`.
- Webhook delivery is retried up to 5 times. Set \`WEBHOOK_SECRET\` to sign payloads.
- Your workspace has {count} active members. Upgrade before {date} to keep all of your projects.
- If a build fails, run \`npm run doctor\` and share the output with support.`;

export const prompt = `Aşağıdaki İngilizce sürüm notlarını doğal, akıcı, resmî olmayan ama profesyonel bir Türkçeye çevir (Markdown yapısını koru).

Kurallar (otomatik denetlenecek):
- Sözlük: deployment → "dağıtım", rollback → "geri alma", rate limit → "hız sınırı". Webhook kelimesi olduğu gibi kalır.
- \`kod\` aralıkları, {yer_tutucular} ve sayılar BİREBİR aynı kalır (çevirme, biçimini bozma).
- Metinde çevrilmemiş İngilizce cümle parçası kalmasın (kod aralıkları hariç).
Cevapta yalnız çeviriyi ver.

${SRC}`;

export async function check(answer) {
  const a = String(answer);
  const low = a.toLowerCase();
  const notes = [];
  let ok = 0, total = 0;
  const t = (c, m) => { total++; if (c) ok++; else notes.push(m); };
  t(/dağıtım/i.test(a), "'dağıtım' terimi kullanılmamış");
  t(/geri alma/i.test(a), "'geri alma' terimi kullanılmamış");
  t(/hız sınırı/i.test(a), "'hız sınırı' terimi kullanılmamış");
  t(/webhook/i.test(a), "'webhook' korunmalı");
  for (const code of ["HTTP 429", "WEBHOOK_SECRET", "npm run doctor"]) t(a.includes("`" + code + "`"), `kod aralığı bozulmuş: \`${code}\``);
  for (const ph of ["{count}", "{date}"]) t(a.includes(ph), `yer tutucu bozulmuş: ${ph}`);
  for (const n of ["90", "600", "5", "4.2"]) t(a.includes(n), `sayı kaybolmuş: ${n}`);
  const stripped = low.replace(/`[^`]*`/g, " ").replace(/\{[^}]*\}/g, " ");
  const leftovers = (stripped.match(/\b(the|and|with|your|you|now|each|from|before|keep|share|support|fails|active|members|workspace|upgrade|requests|minute)\b/g) ?? []);
  t(leftovers.length === 0, `çevrilmemiş İngilizce kelimeler: ${[...new Set(leftovers)].join(", ")}`);
  t(/[çğıöşü]/i.test(a) && a.startsWith("##") || /^#/m.test(a), "Markdown başlığı korunmalı");
  t(a.split("\n").filter((l) => l.trim().startsWith("- ")).length >= 4, "4 madde işareti korunmalı");
  return result(ok === total, ok / total, notes);
}

export const reference = `## 4.2 sürüm notları

Daha hızlı bir dağıtım hattı yayınladık. Her dağıtım artık 90 saniyenin altında bitiyor ve panelden tek tıkla geri alma başlatabilirsin.

- API artık token başına dakikada 600 istek hız sınırı uyguluyor. Sınırı aşan istekler \`HTTP 429\` döner.
- Webhook gönderimi en fazla 5 kez yeniden denenir. Yükleri imzalamak için \`WEBHOOK_SECRET\` değerini ayarla.
- Çalışma alanında {count} aktif üye var. Tüm projelerini korumak için {date} tarihinden önce yükselt.
- Bir derleme başarısız olursa \`npm run doctor\` komutunu çalıştır ve çıktıyı destek ekibiyle paylaş.`;
export const wrong = "## Release 4.2 notes\n\nWe shipped a faster deployment pipeline.";
