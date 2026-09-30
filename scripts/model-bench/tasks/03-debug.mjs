import fs from "node:fs";
import path from "node:path";
import { extractCode, runNode, tmpDir, result } from "../lib.mjs";

export const id = "debug";
export const title = "Hata ayıkla (kök neden + düzeltme)";
export const category = "Kod";

export const prompt = `Aşağıdaki fonksiyon üretimde yanlış sonuç veriyor. Log'a bakıp KÖK NEDENLERİ bul ve düzeltilmiş tam fonksiyonu yaz.

Beklenen davranış (spesifikasyon):
- parseDuration(str) süreyi MİLİSANİYE olarak döner. Birimler: d, h, m, s, ms. Ondalık sayı olabilir ("1.5h"). Birimler arasında boşluk olabilir ("1h 30m"), baştaki/sondaki boşluk yok sayılır.
- Metnin TAMAMI geçerli olmalı. Geçersizse (boş metin, tanınmayan birim, birimsiz sayı, string olmayan girdi) \`throw new TypeError("invalid duration")\`.

\`\`\`js
function parseDuration(str) {
  var re = /(\\d+)(h|m|s|ms|d)/g;
  var units = { d: 86400000, h: 3600000, m: 60000, s: 1000, ms: 1 };
  var total = 0, m;
  while ((m = re.exec(str)) !== null) total += parseInt(m[1]) * units[m[2]];
  return total;
}
\`\`\`

Üretim logu:
\`\`\`
parseDuration("500ms")   -> 30000000   (beklenen 500)
parseDuration("1.5h")    -> 18000000   (beklenen 5400000)
parseDuration("abc")     -> 0          (beklenen: TypeError: invalid duration)
parseDuration("1h30")    -> 3600000    (beklenen: TypeError: invalid duration)
parseDuration(42)        -> 0          (beklenen: TypeError: invalid duration)
\`\`\`

Cevapta önce kısa bir kök neden açıklaması, sonra düzeltilmiş fonksiyonu tek bir \`\`\`js bloğunda ver. Fonksiyon adı parseDuration olsun.`;

const TESTS = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("./fn.js", import.meta.url), "utf8");
const parseDuration = new Function(src + "\\nreturn parseDuration;")();
const bad = (v) => assert.throws(() => parseDuration(v), (e) => e instanceof TypeError && e.message === "invalid duration");
test("ms", () => assert.equal(parseDuration("500ms"), 500));
test("bileşik", () => assert.equal(parseDuration("1h30m"), 5400000));
test("boşluklu", () => assert.equal(parseDuration("1h 30m"), 5400000));
test("gün", () => assert.equal(parseDuration("2d"), 172800000));
test("ondalık", () => assert.equal(parseDuration("1.5h"), 5400000));
test("saniye", () => assert.equal(parseDuration("45s"), 45000));
test("m ve ms birlikte", () => assert.equal(parseDuration("1m500ms"), 60500));
test("kenar boşluk", () => assert.equal(parseDuration("  10s "), 10000));
test("geçersiz: abc", () => bad("abc"));
test("geçersiz: boş", () => bad(""));
test("geçersiz: birim", () => bad("5x"));
test("geçersiz: birimsiz", () => bad("1h30"));
test("geçersiz: sonda çöp", () => bad("10s5"));
test("geçersiz: sayı girdi", () => bad(42));
test("geçersiz: undefined", () => bad(undefined));
`;

export async function check(answer) {
  const code = extractCode(answer, ["js", "javascript"]);
  if (!/parseDuration/.test(code)) return result(false, 0, ["parseDuration fonksiyonu bulunamadı"]);
  const dir = tmpDir("dbg-");
  try {
    fs.writeFileSync(path.join(dir, "fn.js"), code.replace(/^export\s+/gm, ""));
    fs.writeFileSync(path.join(dir, "fn.test.mjs"), TESTS);
    const r = runNode(["--test", "fn.test.mjs"], { cwd: dir });
    const passed = Number(/# pass (\d+)/.exec(r.out)?.[1] ?? 0);
    const failed = Number(/# fail (\d+)/.exec(r.out)?.[1] ?? 0);
    const names = [...r.out.matchAll(/not ok \d+ - (.*)/g)].map((m) => m[1]).slice(0, 5);
    return result(r.code === 0, passed / Math.max(passed + failed, 1), r.code === 0 ? [] : [`Başarısız: ${names.join(", ") || r.out.split("\n")[0]}`]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export const reference = "Kök neden: regex'te `m` `ms`'den önce eşleşiyor, sayı ondalığı yakalamıyor ve tüm metin doğrulanmıyor.\n```js\n" + `function parseDuration(str) {
  const bad = () => { throw new TypeError("invalid duration"); };
  if (typeof str !== "string") bad();
  const s = str.trim();
  if (!s) bad();
  const units = { d: 86400000, h: 3600000, m: 60000, s: 1000, ms: 1 };
  const re = /(\\d+(?:\\.\\d+)?)\\s*(ms|d|h|m|s)/y;
  let total = 0, pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) bad();
    total += parseFloat(m[1]) * units[m[2]];
    pos = re.lastIndex;
    while (s[pos] === " ") pos++;
  }
  return Math.round(total);
}
` + "```";
export const wrong = "```js\nfunction parseDuration(str){ return 0; }\n```";
