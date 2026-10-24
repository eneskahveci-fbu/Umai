/* Local Bridge güvenlik/davranış testleri (node:test — ek bağımlılık yok).
 *
 * Çalıştırma:  node --test local-bridge/test   (veya: npm run test:bridge)
 *
 * Kapsam: token zorunluluğu, symlink kaçışının engellenmesi, yazma boyutu,
 * kök dizin silme koruması, komut zaman aşımı, doğru HTTP durum kodları ve
 * origin süzgeci. Sunucu gerçek bir süreç olarak ayağa kaldırılır. */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const SERVER = path.join(__dirname, "..", "server.js");
const TOKEN = "test-token-0123456789";
const MAX_FILE_BYTES = 1024;

let child;
let base;
let root;
let outsideDir;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) return;
    } catch { /* henüz dinlemiyor */ }
    await sleep(50);
  }
  throw new Error("Sunucu zamanında ayağa kalkmadı");
}

test.before(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "bridge-test-"));
  /* Kökün DIŞINDA gerçek bir dosya + kökün İÇİNDE ona giden symlink. */
  const outside = await fsp.mkdtemp(path.join(os.tmpdir(), "bridge-outside-"));
  outsideDir = outside;
  await fsp.writeFile(path.join(outside, "gizli.txt"), "kök dışı gizli içerik", "utf-8");
  await fsp.symlink(outside, path.join(root, "disari"));
  /* Hedefi HENÜZ var olmayan symlink (dangling) — yazma ile dışarıda dosya
     oluşturulamamalı. */
  await fsp.symlink(path.join(outside, "yeni-dosya.txt"), path.join(root, "kacis"));
  /* Kendine işaret eden symlink döngüsü. */
  await fsp.symlink("dongu", path.join(root, "dongu"));

  const port = 44000 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      WORK_DIR: root,
      BRIDGE_TOKEN: TOKEN,
      MAX_FILE_BYTES: String(MAX_FILE_BYTES),
      MAX_BODY_BYTES: "4096",
      EXEC_TIMEOUT_MS: "500",
    },
    stdio: "ignore",
  });
  await waitForHealth(base);
});

test.after(async () => {
  if (child) child.kill("SIGKILL");
  if (root) await fsp.rm(root, { recursive: true, force: true });
});

function post(endpoint, body, { token = TOKEN, headers = {} } = {}) {
  return fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
  });
}

test("/health token'sız çalışır ama kök yolu sızdırmaz", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.root, undefined, "kök dizin kimlik doğrulamasız sızmamalı");
});

test("/health token ile kök yolu döner", async () => {
  const r = await fetch(`${base}/health`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(typeof d.root === "string" && d.root.length > 0);
});

test("token'sız korumalı uç 401 döner", async () => {
  const r = await post("/fs/list", {}, { token: "" });
  assert.equal(r.status, 401);
});

test("yanlış token 401 döner", async () => {
  const r = await post("/fs/list", {}, { token: "yanlis-token-0123456789" });
  assert.equal(r.status, 401);
});

test("symlink ile kök dışına çıkılamaz (eski açık)", async () => {
  const r = await post("/fs/read", { path: "disari/gizli.txt" });
  assert.equal(r.status, 400);
  const d = await r.json();
  assert.match(d.error, /symlink|dışında/i);
  assert.equal(d.content, undefined);
});

test("yol gezinmesi (../) engellenir", async () => {
  const r = await post("/fs/read", { path: "../gizli.txt" });
  assert.equal(r.status, 400);
});

test("hedefi olmayan (dangling) symlink ile dışarıda dosya oluşturulamaz", async () => {
  const r = await post("/fs/write", { path: "kacis", content: "sızma" });
  assert.equal(r.status, 400);
  await assert.rejects(fsp.access(path.join(outsideDir, "yeni-dosya.txt")));
});

test("symlink döngüsü 400 döner", async () => {
  const r = await post("/fs/read", { path: "dongu" });
  assert.equal(r.status, 400);
});

test("kök içinde yazma/okuma çalışır", async () => {
  const w = await post("/fs/write", { path: "alt/dosya.txt", content: "merhaba" });
  assert.equal(w.status, 200);
  const wd = await w.json();
  assert.equal(wd.created, true);

  const r = await post("/fs/read", { path: "alt/dosya.txt" });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.content, "merhaba");
});

test("boyut sınırını aşan yazma 413 döner", async () => {
  const r = await post("/fs/write", { path: "buyuk.txt", content: "x".repeat(MAX_FILE_BYTES + 10) });
  assert.equal(r.status, 413);
});

test("boyut sınırını aşan dosya okuma 413 döner", async () => {
  await fsp.writeFile(path.join(root, "buyuk-dosya.txt"), "y".repeat(MAX_FILE_BYTES + 10), "utf-8");
  const r = await post("/fs/read", { path: "buyuk-dosya.txt" });
  assert.equal(r.status, 413);
});

test("kök dizin silinemez", async () => {
  const r = await post("/fs/delete", { path: "." });
  assert.equal(r.status, 400);
  /* Workspace hâlâ yerinde mi? */
  const list = await post("/fs/list", {});
  assert.equal(list.status, 200);
});

test("uzun komut zaman aşımına uğrar (504)", async () => {
  const r = await post("/exec", { command: "sleep 5" });
  assert.equal(r.status, 504);
  const d = await r.json();
  assert.equal(d.timedOut, true);
  assert.match(d.error, /zaman aşımı/i);
});

test("kısa komut normal çalışır", async () => {
  const r = await post("/exec", { command: "echo selam" });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.match(String(d.output), /selam/);
  assert.equal(d.exitCode, 0);
});

test("geçersiz JSON 400 döner", async () => {
  const r = await post("/fs/list", "{bozuk json");
  assert.equal(r.status, 400);
});

test("gövde boyutu sınırı aşılınca 413 döner", async () => {
  const r = await post("/fs/list", JSON.stringify({ filter: "x".repeat(5000) }));
  assert.equal(r.status, 413);
});

test("bilinmeyen uç 404 döner", async () => {
  const r = await post("/yok/boyle/bir/sey", {});
  assert.equal(r.status, 404);
});

test("yanlış metot 405 döner", async () => {
  const r = await fetch(`${base}/fs/list`, {
    method: "GET",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert.equal(r.status, 405);
});

test("ALLOWED_ORIGIN ayarlıysa yabancı origin 403 alır", async () => {
  /* Ayrı süreç: origin süzgeci başlangıçta okunuyor. */
  const port = 45000 + Math.floor(Math.random() * 1000);
  const url = `http://127.0.0.1:${port}`;
  const c = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      WORK_DIR: root,
      BRIDGE_TOKEN: TOKEN,
      ALLOWED_ORIGIN: "https://umai.vercel.app",
    },
    stdio: "ignore",
  });
  try {
    await waitForHealth(url);
    const bad = await fetch(`${url}/fs/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        Origin: "https://kotu-site.example",
      },
      body: "{}",
    });
    assert.equal(bad.status, 403);

    const good = await fetch(`${url}/fs/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        Origin: "https://umai.vercel.app",
      },
      body: "{}",
    });
    assert.equal(good.status, 200);
  } finally {
    c.kill("SIGKILL");
  }
});
