import fs from "node:fs";
import path from "node:path";
import { extractCode, runNode, tmpDir, result } from "../lib.mjs";

export const id = "tests";
export const title = "Test paketi yaz (mutasyon testiyle ölçülür)";
export const category = "Kod";

const SRC = `export function slugify(input, { separator = "-", maxLength = 60 } = {}) {
  if (typeof input !== "string") throw new TypeError("input must be a string");
  const map = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "c", "Ğ": "g", "İ": "i", "I": "i", "Ö": "o", "Ş": "s", "Ü": "u" };
  const esc = separator.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
  let s = input.replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => map[c]);
  s = s.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, separator);
  s = s.replace(new RegExp("^(?:" + esc + ")+|(?:" + esc + ")+$", "g"), "");
  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
    s = s.replace(new RegExp("(?:" + esc + ")+$"), "");
  }
  return s;
}
`;

export const prompt = `Aşağıdaki modül için Node'un yerleşik test çalıştırıcısıyla (\`node:test\` + \`node:assert/strict\`) kapsamlı bir birim test paketi yaz. Dosya \`./slugify.mjs\` içinden \`import { slugify } from "./slugify.mjs"\` ile alır. Kenar durumlarını (Türkçe harfler, ayraç seçeneği, maxLength kesimi ve kesimden sonra ayraç temizliği, rakamlar, hata fırlatma, boş girdi vb.) yakala. Testler doğru uygulamada geçmeli; ama kod bozulursa (hatalı sürümler) başarısız olmalı — kalite bununla ölçülecek.

Cevapta yalnız tek bir \`\`\`js kod bloğu (slugify.test.mjs) ver.

\`\`\`js
${SRC}\`\`\``;

// Mutantlar: her biri gerçekten davranışı bozar.
const MUTANTS = [
  ["hata fırlatmayı kaldır", (s) => s.replace('throw new TypeError("input must be a string")', 'return ""')],
  ["varsayılan maxLength 60→50", (s) => s.replace("maxLength = 60", "maxLength = 50")],
  ["ı→1", (s) => s.replace('"ı": "i"', '"ı": "1"')],
  ["kesim sonrası ayraç temizliği yok", (s) => s.replace(/    s = s\.replace\(new RegExp\("\(\?:" \+ esc \+ "\)\+\$"\), ""\);\n/, "")],
  ["rakamları at", (s) => s.replace("[^a-z0-9]+", "[^a-z]+")],
  ["kenar ayraçları temizleme yok", (s) => s.replace(/  s = s\.replace\(new RegExp\("\^\(\?:"[^\n]*\n/, "")],
];

function runSuite(dir, testCode, srcCode) {
  fs.writeFileSync(path.join(dir, "slugify.mjs"), srcCode);
  fs.writeFileSync(path.join(dir, "slugify.test.mjs"), testCode);
  return runNode(["--test", "slugify.test.mjs"], { cwd: dir });
}

export async function check(answer) {
  const testCode = extractCode(answer, ["js", "javascript", "mjs"]);
  const notes = [];
  const count = (testCode.match(/\b(?:test|it)\s*\(/g) ?? []).length;
  const dir = tmpDir("tst-");
  try {
    const good = runSuite(dir, testCode, SRC);
    if (good.code !== 0) return result(false, 0, [`Testler DOĞRU uygulamada bile başarısız: ${good.out.split("\n").filter((l) => /not ok|Error/.test(l)).slice(0, 3).join(" | ")}`]);
    if (count < 8) notes.push(`Yetersiz test sayısı (${count} < 8)`);
    let killed = 0;
    const survived = [];
    for (const [name, mut] of MUTANTS) {
      const mutated = mut(SRC);
      if (mutated === SRC) throw new Error(`mutant uygulanamadı: ${name}`);
      const r = runSuite(dir, testCode, mutated);
      if (r.code !== 0) killed++; else survived.push(name);
    }
    if (survived.length) notes.push(`Yakalanamayan hatalı sürümler: ${survived.join(", ")}`);
    const pass = count >= 8 && killed >= MUTANTS.length - 1;
    return result(pass, killed / MUTANTS.length, notes);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export const reference = "```js\n" + `import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.mjs";
test("temel", () => assert.equal(slugify("Merhaba Dünya"), "merhaba-dunya"));
test("türkçe harfler", () => assert.equal(slugify("çğıöşü ÇĞİÖŞÜ"), "cgiosu-cgiosu"));
test("noktalanma ve boşluk", () => assert.equal(slugify("  Hello,   World!  "), "hello-world"));
test("rakamlar", () => assert.equal(slugify("Ürün 2024 v3"), "urun-2024-v3"));
test("ayraç", () => assert.equal(slugify("a b c", { separator: "_" }), "a_b_c"));
test("özel ayraç kenarları", () => assert.equal(slugify("!!a!!", { separator: "." }), "a"));
test("boş", () => assert.equal(slugify(""), ""));
test("tip hatası", () => assert.throws(() => slugify(5), TypeError));
test("maxLength", () => assert.equal(slugify("abcdefghij", { maxLength: 4 }), "abcd"));
test("maxLength sonrası ayraç temizliği", () => assert.equal(slugify("abc def", { maxLength: 4 }), "abc"));
test("varsayılan maxLength 60", () => assert.equal(slugify("a".repeat(80)).length, 60));
test("büyük I", () => assert.equal(slugify("ISPARTA"), "isparta"));
test("küçük ı", () => assert.equal(slugify("kız"), "kiz"));
test("kenar ayraçları", () => assert.equal(slugify("---x---"), "x"));
` + "```";
export const wrong = "```js\nimport test from 'node:test';\ntest('x', () => {});\n```";
