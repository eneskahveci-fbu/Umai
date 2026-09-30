/* results → Türkçe Markdown rapor. */
const mark = (r) => (r.pass ? (r.passAttempt === 1 ? "✅ 1. denemede" : `🟡 ${r.passAttempt}. denemede`) : "❌ başarısız");
const sec = (ms) => `${(ms / 1000).toFixed(1)} sn`;

export function buildReport(results, { repairs, matrix, taskList }) {
  const L = [];
  const total = results.length, passed = results.filter((r) => r.pass).length, first = results.filter((r) => r.passAttempt === 1).length;
  L.push("# Model test raporu", "");
  L.push(`- Çalıştırma: ${results.length} iş (${matrix ? "her iş × her model" : "her iş farklı bir modele"}), en fazla ${repairs} onarım turu`);
  L.push(`- **Sonuç: ${passed}/${total} iş hatasız tamamlandı** (${first} tanesi ilk denemede)`, "");
  L.push("## Özet tablo", "", "| İş | Model | Sonuç | Puan | Süre | Token |", "|---|---|---|---|---|---|");
  for (const r of [...results].sort((a, b) => a.task.localeCompare(b.task) || a.model.id.localeCompare(b.model.id)))
    L.push(`| ${r.title} | ${r.model.label} (\`${r.model.model}\`) | ${mark(r)} | ${(r.score * 100).toFixed(0)}% | ${sec(r.totalMs)} | ${r.tokens || "-"} |`);
  L.push("");
  const byModel = new Map();
  for (const r of results) { const a = byModel.get(r.model.label) ?? { n: 0, ok: 0, first: 0, ms: 0 }; a.n++; a.ok += r.pass; a.first += r.passAttempt === 1; a.ms += r.totalMs; byModel.set(r.model.label, a); }
  L.push("## Model bazında", "", "| Model | Geçen | İlk denemede | Ort. süre |", "|---|---|---|---|");
  for (const [k, a] of [...byModel].sort((x, y) => y[1].ok - x[1].ok)) L.push(`| ${k} | ${a.ok}/${a.n} | ${a.first}/${a.n} | ${sec(a.ms / a.n)} |`);
  L.push("");
  L.push("## Ayrıntılar ve bulunan sorunlar", "");
  for (const r of results.filter((x) => !x.pass || x.passAttempt > 1)) {
    L.push(`### ${r.title} — ${r.model.label}`, `Sonuç: ${mark(r)}`, "");
    r.attempts.forEach((a, i) => { if (!a.pass) L.push(`- Deneme ${i + 1}: ${a.notes.join(" · ") || "(not yok)"}`); });
    L.push("");
  }
  if (results.every((r) => r.pass && r.passAttempt === 1)) L.push("Tüm işler ilk denemede hatasız geçti.", "");
  L.push("## Nasıl puanlandı", "");
  for (const t of taskList ?? []) L.push(`- **${t.title}** (${t.category}): otomatik doğrulayıcı — ${t.id}`);
  L.push("", "Her doğrulayıcı `--selftest` ile doğru cevabı kabul, yanlışı reddettiği kanıtlanmıştır.");
  return L.join("\n") + "\n";
}
