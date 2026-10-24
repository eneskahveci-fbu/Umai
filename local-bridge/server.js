/**
 * craft.ai — Local Bridge (Yerel Köprü)
 * ───────────────────────────────────────────────────────────────────────────
 * craft.ai'ı tıpkı Claude Code gibi YERELDE çalıştırmak için sıfır-bağımlılıklı,
 * token korumalı, yalnızca localhost'a bağlanan bir köprü sunucusu.
 *
 * Bu köprü sayesinde web uygulaması, GitHub/GitLab API yerine SENİN
 * BİLGİSAYARINDAKİ gerçek dosya sistemine ve kabuğa erişir:
 *   • Gerçek dosya sistemi  (list / read / write / delete / rename / glob / grep)
 *   • Gerçek kabuk          (komut çalıştır — senkron)
 *   • Arka plan görevleri   (uzun komutu arka planda çalıştır, sonra durumunu sor)
 *   • stdio MCP             (yerel MCP sunucularını spawn et — Claude Code gibi)
 *
 * Hiçbir bulut/sunucu/ücret YOK — her şey kendi makinende çalışır.
 *
 * Kurulum & çalıştırma:
 *   cd local-bridge
 *   BRIDGE_TOKEN=gizli-sifre WORK_DIR=/proje/yolun node server.js
 *   # Ardından uygulamada Ayarlar → Yerel Mod → http://localhost:4319 + token
 *
 * Ortam değişkenleri:
 *   PORT             Dinleme portu           (varsayılan: 4319)
 *   HOST             Dinleme adresi          (varsayılan: 127.0.0.1 — sadece yerel)
 *   BRIDGE_TOKEN     Zorunlu erişim şifresi  (boşsa rastgele üretilir ve yazdırılır)
 *   WORK_DIR         Proje kök dizini        (varsayılan: çalıştırıldığı dizin)
 *   ALLOWED_ORIGIN   CORS izinli origin      (varsayılan: * )
 *   MAX_FILE_BYTES   Okuma/yazma üst sınırı  (varsayılan: 2_000_000)
 *   MAX_BODY_BYTES   HTTP gövde üst sınırı   (varsayılan: 8_000_000)
 *   EXEC_TIMEOUT_MS  Senkron komut zaman aşımı (varsayılan: 120_000)
 *   MAX_TASKS        Arka plan görev üst sınırı (varsayılan: 50)
 *
 * GÜVENLİK NOTU (2026-10 sertleştirme):
 *   - Yol çözümleme artık `realpath` tabanlı: workspace içine konan bir symlink
 *     ile kök dizin dışına çıkılamaz (eski `startsWith` kontrolü bunu kaçırıyordu).
 *   - Kök dizinin kendisi silinemez.
 *   - Yazma boyutu da MAX_FILE_BYTES ile sınırlı (eskiden yalnız okuma sınırlıydı).
 *   - Senkron komutlar EXEC_TIMEOUT_MS sonunda öldürülür (eskiden istek sonsuza
 *     kadar asılı kalabiliyordu).
 *   - Hatalar artık doğru HTTP durum koduyla döner (eskiden her şey 200'dü, bu
 *     yüzden istemci/izleme hataları göremiyordu). Gövde şekli aynı: { error }.
 */

"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "4319", 10);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.resolve(process.env.WORK_DIR || process.cwd());
/* Symlink karşılaştırmaları için kökün GERÇEK yolu (WORK_DIR bir symlink olabilir). */
const ROOT_REAL = (() => {
  try { return fs.realpathSync(ROOT); } catch { return ROOT; }
})();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_BYTES || "2000000", 10);
const MAX_BODY_BYTES = parseInt(process.env.MAX_BODY_BYTES || "8000000", 10);
const EXEC_TIMEOUT_MS = parseInt(process.env.EXEC_TIMEOUT_MS || "120000", 10);
const MAX_TASKS = parseInt(process.env.MAX_TASKS || "50", 10);
const TASK_TTL_MS = 60 * 60 * 1000;
let TOKEN = process.env.BRIDGE_TOKEN || "";

/* Token zorunlu — boşsa rastgele üret ve yazdır (asla açık bırakma). */
if (!TOKEN) {
  TOKEN = crypto.randomBytes(18).toString("base64url");
  console.log("⚠️  BRIDGE_TOKEN ayarlanmadı — bu oturum için rastgele üretildi:");
  console.log("    " + TOKEN);
} else if (TOKEN.length < 16) {
  console.log("⚠️  BRIDGE_TOKEN çok kısa (<16 karakter) — daha uzun bir token önerilir.");
}

/* Loopback dışına açılıp CORS'u da herkese açık bırakmak tehlikeli: uyar. */
if (!["127.0.0.1", "::1", "localhost"].includes(HOST) && ALLOWED_ORIGIN === "*") {
  console.log("⚠️  HOST loopback değil ve ALLOWED_ORIGIN=* — köprü ağa açık. ALLOWED_ORIGIN ayarlaman önerilir.");
}

/* Performans/gürültü için varsayılan yok sayılan dizinler. */
const IGNORED_DIRS = new Set([
  ".git", "node_modules", ".next", "dist", "build", "coverage",
  ".turbo", ".cache", ".vercel", "out", ".idea", ".DS_Store",
]);

/* HTTP durum kodu taşıyan hata — catch bloğu bunu olduğu gibi kullanır. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ── Güvenlik: yol her zaman ROOT içinde kalmalı (path traversal + symlink) ──
   Yol adım adım çözülür; her symlink hedefi de denetlenir. Böylece workspace
   içine yerleştirilmiş bir symlink (`disari -> /etc`) ile kök dışına çıkılamaz.
   Hedefi henüz var olmayan (dangling) symlink'ler de reddedilir — aksi halde
   `link -> /etc/yeni-dosya` üzerinden kök dışında dosya oluşturulabilirdi. */
const MAX_SYMLINK_HOPS = 40;
async function safeResolve(rel) {
  const p = path.resolve(ROOT, String(rel ?? "."));
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) {
    throw new HttpError(400, "Yol kök dizinin dışında: " + rel);
  }
  let probe = p;
  let rest = "";
  let hops = 0;
  for (;;) {
    let st = null;
    try { st = await fsp.lstat(probe); }
    catch (e) {
      if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e;
    }
    if (st && st.isSymbolicLink()) {
      if (++hops > MAX_SYMLINK_HOPS) throw new HttpError(400, "Çok fazla symlink: " + rel);
      const target = await fsp.readlink(probe);
      probe = path.resolve(path.dirname(probe), target);
      continue;
    }
    if (st) {
      /* Var olan en derin atayı gerçek yoluyla çöz. */
      const real = await fsp.realpath(probe);
      const full = rest ? path.resolve(real, rest) : real;
      if (full !== ROOT_REAL && !full.startsWith(ROOT_REAL + path.sep)) {
        throw new HttpError(400, "Yol kök dizinin dışında (symlink): " + rel);
      }
      return full;
    }
    /* Henüz var olmayan dosya (write): en yakın var olan ataya in. */
    const parent = path.dirname(probe);
    if (parent === probe) throw new HttpError(400, "Yol çözülemedi: " + rel);
    rest = path.join(path.basename(probe), rest);
    probe = parent;
  }
}

/* ── Basit glob → RegExp (*, **, ? destekler) ── */
function globToRegExp(glob) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if ("\\^$.|+()[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp(re + "$");
}

/* ── Dosya ağacını gez (yok sayılanları atla; symlink'leri takip etmez) ── */
async function walk(dir, acc) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
  catch { return acc; }
  for (const e of entries) {
    if (IGNORED_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (e.isFile()) acc.push(path.relative(ROOT, full).split(path.sep).join("/"));
  }
  return acc;
}

/* ── Arka plan görev kayıtları ── */
const tasks = new Map(); // id → { status, output, exitCode, startedAt, command }

/* Bitmiş ve TTL'i geçmiş görevleri at; harita sınırsız büyümesin. */
function purgeTasks() {
  const now = Date.now();
  for (const [id, rec] of tasks) {
    if (rec.status !== "running" && now - rec.startedAt > TASK_TTL_MS) tasks.delete(id);
  }
}

function runBackground(command, cwd) {
  purgeTasks();
  if (tasks.size >= MAX_TASKS) {
    throw new HttpError(429, `Aynı anda en fazla ${MAX_TASKS} arka plan görevi tutulabilir.`);
  }
  const id = crypto.randomBytes(8).toString("hex");
  const rec = { status: "running", output: "", exitCode: null, startedAt: Date.now(), command };
  tasks.set(id, rec);
  const child = spawn(command, { cwd, shell: true });
  const cap = (d) => { rec.output += d.toString(); if (rec.output.length > 500_000) rec.output = rec.output.slice(-500_000); };
  child.stdout.on("data", cap);
  child.stderr.on("data", cap);
  child.on("close", (code) => { rec.status = "done"; rec.exitCode = code; });
  child.on("error", (err) => { rec.status = "error"; rec.output += "\n" + err.message; rec.exitCode = -1; });
  return id;
}

/* Senkron komut: EXEC_TIMEOUT_MS sonunda SIGKILL — istek asılı kalmasın. */
function runForeground(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true });
    let out = "";
    let timedOut = false;
    const cap = (d) => { out += d.toString(); if (out.length > 500_000) out = out.slice(-500_000); };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGKILL"); } catch { /* zaten ölmüş */ }
    }, EXEC_TIMEOUT_MS);
    const finish = (exitCode) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          error: `Komut ${EXEC_TIMEOUT_MS} ms içinde bitmedi (zaman aşımı).`,
          output: out,
          exitCode,
          timedOut: true,
        });
        return;
      }
      resolve({ output: out || "(çıktı yok)", exitCode });
    };
    child.on("close", (code) => finish(code));
    child.on("error", (err) => { clearTimeout(timer); resolve({ error: "Hata: " + err.message, output: out, exitCode: -1 }); });
  });
}

/* ── stdio MCP: yerel bir MCP sunucusunu spawn edip JSON-RPC konuş ── */
function mcpRpc(command, args, env, requests) {
  return new Promise((resolve) => {
    const child = spawn(command, args || [], {
      cwd: ROOT,
      env: { ...process.env, ...(env || {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buf = "";
    const responses = {};
    const done = () => { try { child.kill(); } catch { /* yok say */ } resolve(responses); };
    const timer = setTimeout(done, 15000);
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id != null) responses[msg.id] = msg;
        } catch { /* parçalı/log satırı */ }
      }
      /* tüm beklenen yanıtlar geldiyse bitir */
      if (requests.every((r) => responses[r.id] !== undefined)) { clearTimeout(timer); done(); }
    });
    child.on("error", () => { clearTimeout(timer); resolve({ error: "spawn edilemedi" }); });
    for (const r of requests) child.stdin.write(JSON.stringify(r) + "\n");
  });
}

/* ── HTTP yardımcıları ── */
function send(res, code, obj) {
  if (res.writableEnded || res.destroyed) return;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (ALLOWED_ORIGIN !== "*") headers["Vary"] = "Origin";
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

/* Gövde: boyut sınırı + geçersiz JSON'da 400 (eskiden sessizce {} oluyordu). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let aborted = false;
    const chunks = [];
    req.on("data", (c) => {
      if (aborted) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        chunks.length = 0;
        reject(new HttpError(413, `İstek gövdesi çok büyük (üst sınır ${MAX_BODY_BYTES} bayt).`));
        /* Soketi hemen kapatma: 413 yanıtı ulaşsın; kalan gövdeyi at. */
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (aborted) return;
      const data = Buffer.concat(chunks).toString("utf-8");
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(new HttpError(400, "Geçersiz JSON gövdesi.")); }
    });
    req.on("error", () => reject(new HttpError(400, "İstek gövdesi okunamadı.")));
  });
}

function authed(req) {
  const h = req.headers["authorization"] || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : "";
  const alt = req.headers["x-bridge-token"] || "";
  const given = bearer || alt;
  if (given.length !== TOKEN.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN)); } catch { return false; }
}

/* Origin kontrolü — ALLOWED_ORIGIN=* değilse tarayıcı isteklerini de süz. */
function originAllowed(req) {
  if (ALLOWED_ORIGIN === "*") return true;
  const o = req.headers.origin;
  return !o || o === ALLOWED_ORIGIN;
}

/* ── Yönlendirme ── */
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});

  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  const isAuthed = authed(req);

  if (!originAllowed(req)) return send(res, 403, { error: "Origin izinli değil." });

  /* Sağlık ucu token'sız çalışır ama kök dizin yolunu SIZDIRMAZ. */
  if (route === "/health") {
    return send(res, 200, {
      ok: true,
      name: "craft-local-bridge",
      version: "1.1.0",
      ...(isAuthed ? { root: ROOT } : {}),
    });
  }

  if (!isAuthed) return send(res, 401, { error: "Geçersiz veya eksik token." });

  try {
    if (route === "/exec/status") {
      if (req.method !== "GET") return send(res, 405, { error: "Bu uç yalnız GET kabul eder." });
      const rec = tasks.get(url.searchParams.get("id") || "");
      if (!rec) return send(res, 404, { error: "Görev bulunamadı" });
      return send(res, 200, rec);
    }

    if (req.method !== "POST") return send(res, 405, { error: "Bu uç yalnız POST kabul eder." });
    const body = await readBody(req);

    switch (route) {
      case "/fs/list": {
        let paths = await walk(ROOT, []);
        const f = (body.filter || "").toLowerCase();
        if (f) paths = paths.filter((p) => p.toLowerCase().includes(f));
        return send(res, 200, { paths: paths.slice(0, 5000) });
      }
      case "/fs/read": {
        const p = await safeResolve(body.path);
        const st = await fsp.stat(p);
        if (!st.isFile()) throw new HttpError(400, "Okunacak yol bir dosya değil.");
        if (st.size > MAX_FILE_BYTES) throw new HttpError(413, `Dosya çok büyük (${st.size} bayt)`);
        return send(res, 200, { content: await fsp.readFile(p, "utf-8") });
      }
      case "/fs/write": {
        const p = await safeResolve(body.path);
        const content = String(body.content ?? "");
        const bytes = Buffer.byteLength(content, "utf-8");
        if (bytes > MAX_FILE_BYTES) {
          throw new HttpError(413, `Yazılacak içerik çok büyük (${bytes} bayt, üst sınır ${MAX_FILE_BYTES})`);
        }
        let created = false;
        try { await fsp.access(p); } catch { created = true; }
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.writeFile(p, content, "utf-8");
        return send(res, 200, { ok: true, created });
      }
      case "/fs/delete": {
        const p = await safeResolve(body.path);
        /* Kök dizinin kendisini silmek = workspace'i tamamen yok etmek. */
        if (p === ROOT_REAL || p === ROOT) throw new HttpError(400, "Kök dizin silinemez.");
        await fsp.rm(p, { recursive: true, force: true });
        return send(res, 200, { ok: true });
      }
      case "/fs/rename": {
        const from = await safeResolve(body.path);
        const to = await safeResolve(body.newPath);
        if (to === ROOT_REAL || to === ROOT) throw new HttpError(400, "Kök dizin hedef olamaz.");
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.rename(from, to);
        return send(res, 200, { ok: true });
      }
      case "/fs/glob": {
        const re = globToRegExp(body.pattern || "**");
        const paths = (await walk(ROOT, [])).filter((p) => re.test(p));
        return send(res, 200, { paths: paths.slice(0, 2000) });
      }
      case "/fs/grep": {
        let re;
        try { re = new RegExp(body.pattern, body.ignoreCase ? "i" : ""); }
        catch (e) { throw new HttpError(400, "Geçersiz regex: " + e.message); }
        let paths = await walk(ROOT, []);
        if (body.glob) { const g = globToRegExp(body.glob); paths = paths.filter((p) => g.test(p)); }
        const matches = [];
        for (const rel of paths) {
          if (matches.length >= 300) break;
          let text;
          try { text = await fsp.readFile(path.join(ROOT, rel), "utf-8"); } catch { continue; }
          const lines = text.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              matches.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
              if (matches.length >= 300) break;
            }
          }
        }
        return send(res, 200, { matches });
      }
      case "/exec": {
        const command = String(body.command || "").trim();
        if (!command) throw new HttpError(400, "command zorunlu");
        const cwd = body.cwd ? await safeResolve(body.cwd) : ROOT;
        if (body.background) return send(res, 200, { taskId: runBackground(command, cwd) });
        const result = await runForeground(command, cwd);
        if (result.timedOut) return send(res, 504, result);
        return send(res, 200, result);
      }
      case "/mcp/list": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-local-bridge", version: "1.1.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        if (r.error) throw new HttpError(502, r.error);
        const tools = r[1] && r[1].result && r[1].result.tools ? r[1].result.tools : [];
        return send(res, 200, { tools });
      }
      case "/mcp/call": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-local-bridge", version: "1.1.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: body.tool, arguments: body.arguments || {} } },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        if (r.error) throw new HttpError(502, r.error);
        const result = r[1] && r[1].result ? r[1].result : { error: "yanıt yok" };
        return send(res, 200, { result });
      }
      default:
        return send(res, 404, { error: "Bilinmeyen uç: " + route });
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error(`[HATA] ${req.method} ${route}:`, e && e.message ? e.message : e);
    return send(res, status, { error: e && e.message ? e.message : "Bilinmeyen hata" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✅ craft.ai Local Bridge çalışıyor`);
  console.log(`   Adres : http://${HOST}:${PORT}`);
  console.log(`   Kök   : ${ROOT}`);
  console.log(`   Token : ${TOKEN.slice(0, 4)}…(${TOKEN.length} karakter)`);
  console.log(`   Komut zaman aşımı: ${EXEC_TIMEOUT_MS} ms`);
  console.log(`   Uygulamada: Ayarlar → Yerel Mod → bu adres + token`);
});
