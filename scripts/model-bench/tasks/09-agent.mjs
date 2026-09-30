import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { callModel, runNode, tmpDir, result } from "../lib.mjs";

export const id = "agent";
export const title = "Çok adımlı ajan görevi (araç kullanarak hata düzelt)";
export const category = "İş";
export const usesTools = true;

const FILES = {
  "tax.js": `const RATES = { food: 0.08, book: 0.01, medicine: 0, other: 0.2 };
function taxFor(amount, category) {
  const r = RATES[category] || RATES.other;
  return Math.floor(amount * r * 100) / 100;
}
module.exports = { taxFor, RATES };
`,
  "pricing.js": `const { taxFor } = require("./tax");
function round2(n) { return Math.round(n * 100) / 100; }
function priceWithTax(net, category, discountPct = 0) {
  const discounted = round2(net * (1 - discountPct / 100));
  return round2(discounted + taxFor(discounted, category));
}
function cartTotal(lines) {
  return round2(lines.reduce((s, l) => s + priceWithTax(l.net, l.category, l.discountPct) * l.qty, 0));
}
module.exports = { priceWithTax, cartTotal };
`,
  "test.js": `const assert = require("node:assert/strict");
const { priceWithTax, cartTotal } = require("./pricing");
const cases = [
  ["yemek indirimli", () => assert.equal(priceWithTax(19.99, "food", 10), 19.43)],
  ["ilaç vergisiz", () => assert.equal(priceWithTax(50, "medicine"), 50)],
  ["kitap", () => assert.equal(priceWithTax(100, "book"), 101)],
  ["diğer", () => assert.equal(priceWithTax(10, "other"), 12)],
  ["sepet miktarsız satır 1 sayılır", () => assert.equal(cartTotal([{ net: 100, category: "book" }]), 101)],
  ["sepet toplamı", () => assert.equal(cartTotal([{ net: 10, category: "other", qty: 2 }, { net: 50, category: "medicine", qty: 1 }]), 74)],
];
let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log("ok   - " + name); } catch (e) { failed++; console.log("FAIL - " + name + ": " + e.message.split("\\n")[0]); }
}
if (failed) { console.log(failed + " test başarısız"); process.exit(1); }
console.log("hepsi geçti");
`,
};
const TEST_HASH = crypto.createHash("sha256").update(FILES["test.js"]).digest("hex");

export const prompt = `Bir Node.js projesinde \`node test.js\` başarısız oluyor. Araçları kullanarak (dosyaları listele/oku, testi çalıştır, düzelt, tekrar çalıştır) tüm testleri geçirecek şekilde HATALARI kaynak kodda düzelt. test.js dosyasını DEĞİŞTİRME (testler doğru). İş bitince ne bulduğunu ve neyi değiştirdiğini kısaca özetle.`;

export const tools = [
  { name: "list_files", description: "Proje dizinindeki dosyaları listeler.", parameters: { type: "object", properties: {}, required: [] } },
  { name: "read_file", description: "Bir dosyanın içeriğini okur.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Bir dosyanın tüm içeriğini verilen metinle değiştirir.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "run_tests", description: "`node test.js` çalıştırır ve çıktısını döndürür.", parameters: { type: "object", properties: {}, required: [] } },
];

function setup() {
  const dir = tmpDir("agent-");
  for (const [f, c] of Object.entries(FILES)) fs.writeFileSync(path.join(dir, f), c);
  return dir;
}
function safe(dir, p) {
  const full = path.resolve(dir, String(p ?? ""));
  if (!full.startsWith(dir + path.sep)) throw new Error("dizin dışına erişim yok");
  return full;
}
function exec(dir, name, a) {
  try {
    if (name === "list_files") return fs.readdirSync(dir).join("\n");
    if (name === "read_file") return fs.readFileSync(safe(dir, a.path), "utf8");
    if (name === "write_file") {
      if (path.basename(String(a.path)) === "test.js") return "HATA: test.js değiştirilemez";
      fs.writeFileSync(safe(dir, a.path), String(a.content ?? "")); return "yazıldı";
    }
    if (name === "run_tests") return runNode(["test.js"], { cwd: dir, timeout: 15000 }).out;
    return `HATA: bilinmeyen araç ${name}`;
  } catch (e) { return `HATA: ${e.message}`; }
}

function grade(dir, steps) {
  const notes = [];
  const testSrc = fs.readFileSync(path.join(dir, "test.js"), "utf8");
  if (crypto.createHash("sha256").update(testSrc).digest("hex") !== TEST_HASH) notes.push("test.js değiştirilmiş");
  const r = runNode(["test.js"], { cwd: dir });
  if (r.code !== 0) notes.push(`testler hâlâ başarısız: ${r.out.split("\n").filter((l) => l.startsWith("FAIL")).slice(0, 3).join(" | ")}`);
  if (steps === 0) notes.push("hiç araç çağrısı yapılmadı (araç kullanımı desteklenmiyor olabilir)");
  return result(notes.length === 0, notes.length === 0 ? 1 : 0, notes);
}

/** Özel çalıştırıcı: araç döngüsü. model: {provider,baseUrl,model,apiKey}. */
export async function run(model, { maxTurns = 14 } = {}) {
  const dir = setup();
  const messages = [{ role: "system", content: "Bir yazılım ajanısın. Verilen araçları kullan. Türkçe yanıtla." }, { role: "user", content: prompt }];
  let steps = 0, ms = 0, usage = { in: 0, out: 0 }, final = "";
  try {
    for (let i = 0; i < maxTurns; i++) {
      const r = await callModel(model, messages, { tools });
      ms += r.ms; usage.in += r.usage.in; usage.out += r.usage.out;
      messages.push(r.message);
      if (!r.toolCalls.length) { final = r.text; break; }
      for (const c of r.toolCalls) { steps++; messages.push({ role: "tool", tool_call_id: c.id, content: exec(dir, c.name, c.args) }); }
    }
    const g = grade(dir, steps);
    return { ...g, attempts: 1, ms, usage, answer: final, steps };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/* selftest: doğru düzeltmeyi elle uygula / hiç dokunma */
export async function selftest() {
  const good = setup();
  fs.writeFileSync(path.join(good, "tax.js"), FILES["tax.js"].replace("RATES[category] || RATES.other", "category in RATES ? RATES[category] : RATES.other").replace("Math.floor(amount * r * 100) / 100", "Math.round(amount * r * 100) / 100"));
  fs.writeFileSync(path.join(good, "pricing.js"), FILES["pricing.js"].replace("* l.qty", "* (l.qty ?? 1)"));
  const bad = setup();
  const ref = grade(good, 1), wrong = grade(bad, 1);
  fs.rmSync(good, { recursive: true, force: true }); fs.rmSync(bad, { recursive: true, force: true });
  return { refPass: ref.pass, wrongFail: !wrong.pass, notes: [...ref.notes, ...wrong.notes] };
}
