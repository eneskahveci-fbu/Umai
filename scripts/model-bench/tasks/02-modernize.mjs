import fs from "node:fs";
import path from "node:path";
import { extractCode, runNode, tmpDir, result } from "../lib.mjs";

export const id = "modernize";
export const title = "Eski kodu modernleştir (refactor)";
export const category = "Kod";

const LEGACY = `// cart.js (eski, CommonJS + prototype + callback)
var Cart = function () { this.items = []; this.coupon = null; };
Cart.prototype.addItem = function (name, price, qty) {
  qty = qty || 1;
  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i].name === name) { this.items[i].qty += qty; return; }
  }
  this.items.push({ name: name, price: price, qty: qty });
};
Cart.prototype.removeItem = function (name) {
  this.items = this.items.filter(function (it) { return it.name !== name; });
};
Cart.prototype.subtotal = function () {
  var t = 0;
  this.items.forEach(function (it) { t += it.price * it.qty; });
  return t;
};
Cart.prototype.applyCoupon = function (code) {
  if (code === "SAVE10") { this.coupon = { type: "pct", value: 10 }; return true; }
  if (code === "FIVE") {
    if (this.subtotal() >= 20) { this.coupon = { type: "flat", value: 5 }; return true; }
    return false;
  }
  return false;
};
Cart.prototype.total = function () {
  var s = this.subtotal();
  if (this.coupon) {
    if (this.coupon.type === "pct") s = s - s * this.coupon.value / 100;
    else s = s - this.coupon.value;
  }
  return Math.round(s * 100) / 100;
};
Cart.prototype.checkout = function (cb) {
  var self = this;
  setTimeout(function () {
    if (self.items.length === 0) return cb(new Error("empty"));
    cb(null, { total: self.total(), items: self.items.length });
  }, 0);
};
module.exports = Cart;`;

export const prompt = `Aşağıdaki eski kodu modern JavaScript'e çevir. Davranış BİREBİR aynı kalmalı (küçük "tuhaflıklar" dahil), yalnız biçim modernleşecek.

Hedef:
- ES module: \`export default class Cart\` (CommonJS/prototype/var yok; class alanları, const/let, ok fonksiyonları, uygun dizi metotları kullan).
- addItem, removeItem, subtotal, applyCoupon, total aynı imza ve davranışta.
- checkout artık callback almaz: Promise döner; sepet boşsa \`new Error("empty")\` ile reject, değilse { total, items } ile resolve.
- Cevapta yalnız tek bir \`\`\`js kod bloğu (cart.mjs içeriği) ver.

${"```js\n" + LEGACY + "\n```"}`;

const TESTS = `import test from "node:test";
import assert from "node:assert/strict";
import Cart from "./cart.mjs";

test("aynı ürün miktarı birleşir, varsayılan miktar 1", () => {
  const c = new Cart(); c.addItem("elma", 2); c.addItem("elma", 2, 3);
  assert.equal(c.subtotal(), 8);
});
test("removeItem", () => { const c = new Cart(); c.addItem("a", 5); c.addItem("b", 7); c.removeItem("a"); assert.equal(c.subtotal(), 7); });
test("SAVE10", () => { const c = new Cart(); c.addItem("a", 50); assert.equal(c.applyCoupon("SAVE10"), true); assert.equal(c.total(), 45); });
test("FIVE minimum 20", () => {
  const c = new Cart(); c.addItem("a", 19.99); assert.equal(c.applyCoupon("FIVE"), false); assert.equal(c.total(), 19.99);
  c.addItem("b", 1); assert.equal(c.applyCoupon("FIVE"), true); assert.equal(c.total(), 15.99);
});
test("bilinmeyen kupon", () => { const c = new Cart(); c.addItem("a", 5); assert.equal(c.applyCoupon("XYZ"), false); });
test("kupon sonradan sepet değişse de kalır (eski davranış)", () => {
  const c = new Cart(); c.addItem("a", 25); assert.equal(c.applyCoupon("FIVE"), true); c.removeItem("a"); c.addItem("b", 10); assert.equal(c.total(), 5);
});
test("yuvarlama", () => { const c = new Cart(); c.addItem("a", 0.1, 3); assert.equal(c.total(), 0.3); });
test("örnekler bağımsız", () => { const a = new Cart(), b = new Cart(); a.addItem("x", 1); assert.equal(b.subtotal(), 0); });
test("checkout boş -> reject", async () => { await assert.rejects(new Cart().checkout(), (e) => e instanceof Error && e.message === "empty"); });
test("checkout dolu -> resolve", async () => {
  const c = new Cart(); c.addItem("a", 10, 2); c.addItem("b", 5);
  assert.deepEqual(await c.checkout(), { total: 25, items: 2 });
});
test("checkout callback almaz, Promise döner", () => { const c = new Cart(); c.addItem("a", 1); assert.equal(typeof c.checkout().then, "function"); });
test("var/prototype kalıntısı yok", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./cart.mjs", import.meta.url), "utf8");
  assert.ok(!/\\.prototype\\./.test(src) && !/module\\.exports/.test(src) && !/\\bvar\\s/.test(src));
  assert.ok(/class\\s+Cart/.test(src));
});
`;

export async function check(answer) {
  const code = extractCode(answer, ["js", "javascript", "mjs"]);
  const dir = tmpDir("mod-");
  try {
    fs.writeFileSync(path.join(dir, "cart.mjs"), code);
    fs.writeFileSync(path.join(dir, "cart.test.mjs"), TESTS);
    const r = runNode(["--test", "cart.test.mjs"], { cwd: dir });
    const passed = Number(/# pass (\d+)/.exec(r.out)?.[1] ?? 0);
    const failed = Number(/# fail (\d+)/.exec(r.out)?.[1] ?? 0);
    const notes = r.code === 0 ? [] : [`${failed || "?"} test başarısız: ` + (r.out.split("\n").filter((l) => /not ok|Error|expected|actual/i.test(l)).slice(0, 4).join(" | "))];
    return result(r.code === 0, passed / Math.max(passed + failed, 1), notes);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export const reference = "```js\n" + `export default class Cart {
  items = [];
  coupon = null;
  addItem(name, price, qty = 1) {
    const found = this.items.find((it) => it.name === name);
    if (found) found.qty += qty; else this.items.push({ name, price, qty });
  }
  removeItem(name) { this.items = this.items.filter((it) => it.name !== name); }
  subtotal() { return this.items.reduce((t, it) => t + it.price * it.qty, 0); }
  applyCoupon(code) {
    if (code === "SAVE10") { this.coupon = { type: "pct", value: 10 }; return true; }
    if (code === "FIVE" && this.subtotal() >= 20) { this.coupon = { type: "flat", value: 5 }; return true; }
    return false;
  }
  total() {
    let s = this.subtotal();
    if (this.coupon) s = this.coupon.type === "pct" ? s - (s * this.coupon.value) / 100 : s - this.coupon.value;
    return Math.round(s * 100) / 100;
  }
  checkout() {
    return new Promise((resolve, reject) => setTimeout(() => {
      if (this.items.length === 0) return reject(new Error("empty"));
      resolve({ total: this.total(), items: this.items.length });
    }, 0));
  }
}
` + "```";
export const wrong = "```js\nexport default class Cart { total() { return 0; } }\n```";
