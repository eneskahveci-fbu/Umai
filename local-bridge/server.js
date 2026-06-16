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
 *   PORT            Dinleme portu            (varsayılan: 4319)
 *   HOST            Dinleme adresi           (varsayılan: 127.0.0.1 — sadece yerel)
 *   BRIDGE_TOKEN    Zorunlu erişim şifresi   (boşsa rastgele üretilir ve yazdırılır)
 *   WORK_DIR        Proje kök dizini         (varsayılan: çalıştırıldığı dizin)
 *   ALLOWED_ORIGIN  CORS izinli origin       (varsayılan: * )
 *   MAX_FILE_BYTES  Okuma/yazma üst sınırı   (varsayılan: 2_000_000)
 */

"use strict";

const http = require("http");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "4319", 10);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.resolve(process.env.WORK_DIR || process.cwd());
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_BYTES || "2000000", 10);
let TOKEN = process.env.BRIDGE_TOKEN || "";

/* Token zorunlu — boşsa rastgele üret ve yazdır (asla açık bırakma). */
if (!TOKEN) {
  TOKEN = crypto.randomBytes(18).toString("base64url");
  console.log("⚠️  BRIDGE_TOKEN ayarlanmadı — bu oturum için rastgele üretildi:");
  console.log("    " + TOKEN);
}

/* Performans/gürültü için varsayılan yok sayılan dizinler. */
const IGNORED_DIRS = new Set([
  ".git", "node_modules", ".next", "dist", "build", "coverage",
  ".turbo", ".cache", ".vercel", "out", ".idea", ".DS_Store",
]);

/* ── Güvenlik: yol her zaman ROOT içinde kalmalı (path traversal koruması) ── */
function safeResolve(rel) {
  const p = path.resolve(ROOT, rel || ".");
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) {
    throw new Error("Yol kök dizinin dışında: " + rel);
  }
  return p;
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

/* ── Dosya ağacını gez (yok sayılanları atla) ── */
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

function runBackground(command, cwd) {
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

function runForeground(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true });
    let out = "";
    const cap = (d) => { out += d.toString(); if (out.length > 500_000) out = out.slice(-500_000); };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    child.on("close", (code) => resolve({ output: out || "(çıktı yok)", exitCode: code }));
    child.on("error", (err) => resolve({ output: "Hata: " + err.message, exitCode: -1 }));
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
    const done = () => { try { child.kill(); } catch {} resolve(responses); };
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
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 8_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
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

/* ── Yönlendirme ── */
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;

  if (route === "/health") return send(res, 200, { ok: true, root: ROOT, name: "craft-local-bridge", version: "1.0.0" });

  if (!authed(req)) return send(res, 401, { error: "Geçersiz veya eksik token." });

  try {
    if (route === "/exec/status" && req.method === "GET") {
      const rec = tasks.get(url.searchParams.get("id") || "");
      if (!rec) return send(res, 404, { error: "Görev bulunamadı" });
      return send(res, 200, rec);
    }

    const body = req.method === "POST" ? await readBody(req) : {};

    switch (route) {
      case "/fs/list": {
        let paths = await walk(ROOT, []);
        const f = (body.filter || "").toLowerCase();
        if (f) paths = paths.filter((p) => p.toLowerCase().includes(f));
        return send(res, 200, { paths: paths.slice(0, 5000) });
      }
      case "/fs/read": {
        const p = safeResolve(body.path);
        const st = await fsp.stat(p);
        if (st.size > MAX_FILE_BYTES) return send(res, 200, { error: `Dosya çok büyük (${st.size} bayt)` });
        return send(res, 200, { content: await fsp.readFile(p, "utf-8") });
      }
      case "/fs/write": {
        const p = safeResolve(body.path);
        let created = false;
        try { await fsp.access(p); } catch { created = true; }
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.writeFile(p, String(body.content ?? ""), "utf-8");
        return send(res, 200, { ok: true, created });
      }
      case "/fs/delete": {
        const p = safeResolve(body.path);
        await fsp.rm(p, { recursive: true, force: true });
        return send(res, 200, { ok: true });
      }
      case "/fs/rename": {
        const from = safeResolve(body.path);
        const to = safeResolve(body.newPath);
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
        catch (e) { return send(res, 200, { error: "Geçersiz regex: " + e.message }); }
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
        if (!command) return send(res, 200, { error: "command zorunlu" });
        const cwd = body.cwd ? safeResolve(body.cwd) : ROOT;
        if (body.background) return send(res, 200, { taskId: runBackground(command, cwd) });
        return send(res, 200, await runForeground(command, cwd));
      }
      case "/mcp/list": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-local-bridge", version: "1.0.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        const tools = r[1] && r[1].result && r[1].result.tools ? r[1].result.tools : [];
        return send(res, 200, { tools });
      }
      case "/mcp/call": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-local-bridge", version: "1.0.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: body.tool, arguments: body.arguments || {} } },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        const result = r[1] && r[1].result ? r[1].result : { error: "yanıt yok" };
        return send(res, 200, { result });
      }
      default:
        return send(res, 404, { error: "Bilinmeyen uç: " + route });
    }
  } catch (e) {
    return send(res, 200, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✅ craft.ai Local Bridge çalışıyor`);
  console.log(`   Adres : http://${HOST}:${PORT}`);
  console.log(`   Kök   : ${ROOT}`);
  console.log(`   Token : ${TOKEN.slice(0, 4)}…(${TOKEN.length} karakter)`);
  console.log(`   Uygulamada: Ayarlar → Yerel Mod → bu adres + token`);
});
