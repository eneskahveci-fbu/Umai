#!/usr/bin/env node
/* Model test tezgâhı — 10 gerçek iş × modeller, otomatik doğrulama + onarım turları + rapor.
   Kullanım:
     node scripts/model-bench/run.mjs --selftest                 # doğrulayıcıları (model çağırmadan) sına
     node scripts/model-bench/run.mjs --models models.json       # her iş bir modele (i. iş → i. model)
     node scripts/model-bench/run.mjs --models models.json --matrix --repairs 2 --out sonuc
   Anahtarlar models.json'da `apiKey` ya da `apiKeyEnv` (ortam değişkeni adı) ile verilir; asla yazdırılmaz. */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { callModel, closeBrowser } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const here = path.dirname(url.fileURLToPath(import.meta.url));
const taskFiles = fs.readdirSync(path.join(here, "tasks")).filter((f) => f.endsWith(".mjs")).sort();
let tasks = [];
for (const f of taskFiles) tasks.push(await import(url.pathToFileURL(path.join(here, "tasks", f)).href));
const only = opt("tasks");
if (only) tasks = tasks.filter((t) => only.split(",").includes(t.id));

/* ─── Doğrulayıcı öz-sınaması ─── */
if (flag("selftest")) {
  let bad = 0;
  for (const t of tasks) {
    let ok, detail = "";
    if (t.selftest) { const r = await t.selftest(); ok = r.refPass && r.wrongFail; detail = r.notes.join(" | "); }
    else {
      const good = await t.check(t.reference), no = await t.check(t.wrong);
      ok = good.pass && !no.pass;
      detail = `doğru→${good.pass ? "GEÇTİ" : "KALDI (" + good.notes.join("; ") + ")"} · yanlış→${no.pass ? "GEÇTİ (hata!)" : "kaldı"}`;
    }
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${t.id.padEnd(10)} ${t.title}${ok ? "" : "\n     " + detail}`);
  }
  await closeBrowser();
  console.log(bad ? `\n${bad} doğrulayıcı hatalı` : "\nTüm doğrulayıcılar sağlam (doğru cevabı kabul, yanlışı reddediyor).");
  process.exit(bad ? 1 : 0);
}

/* ─── Gerçek çalıştırma ─── */
const modelsPath = opt("models");
if (!modelsPath) { console.error("--models <dosya.json> gerekli (bkz. models.example.json)"); process.exit(2); }
const models = JSON.parse(fs.readFileSync(modelsPath, "utf8")).filter((m) => m.apiKey || (m.apiKeyEnv && process.env[m.apiKeyEnv]) || m.keyless);
if (!models.length) { console.error("Kullanılabilir model yok (anahtar eksik)."); process.exit(2); }
const repairs = Number(opt("repairs", 2));
const concurrency = Number(opt("concurrency", 3));
const outDir = path.resolve(opt("out", "bench-results"));
fs.mkdirSync(path.join(outDir, "answers"), { recursive: true });

const jobs = [];
tasks.forEach((t, i) => {
  if (flag("matrix")) models.forEach((m) => jobs.push({ t, m }));
  else jobs.push({ t, m: models[i % models.length] });
});

const SYSTEM = "Sen çok yetkin bir yazılım mühendisi ve analistsin. Yalnızca istenen çıktı biçimiyle yanıt ver; kod isteniyorsa tek kod bloğu ver. Uydurma bilgi verme.";

async function runSingle(t, m) {
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: t.prompt }];
  const attempts = [];
  let last = "";
  for (let a = 0; a <= repairs; a++) {
    const started = Date.now();
    let r, chk;
    try {
      r = await callModel(m, messages);
      last = r.text;
      chk = await t.check(r.text);
    } catch (e) {
      attempts.push({ pass: false, score: 0, notes: [`API/çalışma hatası: ${e.message.slice(0, 200)}`], ms: Date.now() - started, error: true });
      break;
    }
    attempts.push({ ...chk, ms: r.ms, usage: r.usage });
    if (chk.pass) break;
    messages.push({ role: "assistant", content: r.text });
    messages.push({ role: "user", content: `Otomatik doğrulama başarısız oldu:\n- ${chk.notes.join("\n- ")}\n\nHataları düzeltip TAM cevabı aynı biçimde yeniden ver.` });
  }
  return { attempts, answer: last };
}

async function runJob({ t, m }) {
  const started = Date.now();
  let out;
  try {
    if (t.run) { const r = await t.run(m); out = { attempts: [{ pass: r.pass, score: r.score, notes: r.notes, ms: r.ms, usage: r.usage }], answer: r.answer ?? "" }; }
    else out = await runSingle(t, m);
  } catch (e) {
    out = { attempts: [{ pass: false, score: 0, notes: [`Beklenmeyen hata: ${e.message.slice(0, 200)}`], ms: 0, error: true }], answer: "" };
  }
  const passIdx = out.attempts.findIndex((a) => a.pass);
  const res = {
    task: t.id, title: t.title, category: t.category,
    model: { id: m.id, label: m.label ?? m.id, model: m.model, provider: m.provider },
    pass: passIdx >= 0, passAttempt: passIdx >= 0 ? passIdx + 1 : null,
    score: out.attempts.at(-1)?.score ?? 0, attempts: out.attempts,
    totalMs: Date.now() - started,
    tokens: out.attempts.reduce((s, a) => s + (a.usage?.in ?? 0) + (a.usage?.out ?? 0), 0),
  };
  fs.writeFileSync(path.join(outDir, "answers", `${t.id}__${m.id}.txt`), out.answer || "(boş)");
  console.log(`${res.pass ? "✅" : "❌"} ${t.id.padEnd(10)} × ${String(m.id).padEnd(18)} ${res.pass ? `${res.passAttempt}. denemede` : "başarısız"}  (${(res.totalMs / 1000).toFixed(1)} sn)`);
  return res;
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
  while (next < jobs.length) { const j = jobs[next++]; results.push(await runJob(j)); }
}));
await closeBrowser();

fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ date: new Date().toISOString(), repairs, results }, null, 2));
const { buildReport } = await import("./report.mjs");
fs.writeFileSync(path.join(outDir, "RAPOR.md"), buildReport(results, { repairs, matrix: flag("matrix"), taskList: tasks }));
console.log(`\nRapor: ${path.join(outDir, "RAPOR.md")}`);
