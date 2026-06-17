#!/usr/bin/env node
/* craft.coder — Hibrit Köprü (Terminal + Sunucu)  ⟶  TEK port, TEK token
 * ════════════════════════════════════════════════════════════════════════
 * Bu köprü, craft.coder'ı tıpkı Claude Code gibi GERÇEK bir ortamda çalıştırır.
 * Tek bir adres (wss:// + token) üzerinden İKİ şey birden sunar:
 *
 *   1) TERMİNAL  (WebSocket /)         — gerçek shell (node-pty), canlı.
 *   2) SUNUCU    (HTTP /fs/*, /exec…)  — gerçek dosya sistemi + komut + MCP.
 *
 * Böylece:
 *   • Vercel'deki site             → bu köprüye bağlanır (Faz 4 hibrit).
 *   • Mobil Safari/Firefox dahil   → WebContainer GEREKMEZ; her şey sunucuda.
 *   • Repo bağlamak ZORUNLU değil   → kalıcı workspace dizini her zaman hazır.
 *
 * Aynı uç noktayı uygulamada İKİ alana da girersin (ikisi de aynı adres+token):
 *   • Ayarlar → Terminal WS URL    : wss://<alan>/?token=<token>
 *   • Ayarlar → Yerel Mod adresi   : https://<alan>     + token: <token>
 *
 * Çalıştırma:
 *   TOKEN=gizli WORK_DIR=/yol/workspace npm start
 *
 * Ortam değişkenleri:
 *   PORT          Dinleme portu              (varsayılan 7777)
 *   HOST          Dinleme adresi             (varsayılan 127.0.0.1; Caddy önünde)
 *   TOKEN         Erişim anahtarı            (boşsa rastgele üretilir, yazdırılır)
 *   WORK_DIR      Workspace kök dizini       (varsayılan: çalıştığı dizin)
 *   CRAFT_SHELL   Terminal kabuğu            (varsayılan: bash / powershell)
 *   ALLOWED_ORIGIN  CORS origin              (varsayılan *)
 *   MAX_FILE_BYTES  Okuma/yazma üst sınırı   (varsayılan 2_000_000)
 *
 * Güvenlik: HTTP token (Bearer/X-Bridge-Token) + WS token (?token=). Tek kullanıcı
 * (root değil) ile çalıştır. Yol her zaman WORK_DIR içinde kalır (path traversal yok).
 * ════════════════════════════════════════════════════════════════════════ */
import { WebSocketServer } from "ws";
import { spawn as ptySpawn } from "node-pty";
import { spawn as procSpawn } from "node:child_process";
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

const PORT = Number(process.env.PORT || 7777);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.resolve(process.env.WORK_DIR || process.cwd());
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_BYTES || "2000000", 10);
const SHELL =
  process.env.CRAFT_SHELL ||
  (os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash");
let TOKEN = process.env.TOKEN || process.env.BRIDGE_TOKEN || "";

if (!TOKEN) {
  TOKEN = crypto.randomBytes(18).toString("base64url");
  console.log("⚠️  TOKEN ayarlanmadı — bu oturum için rastgele üretildi:");
  console.log("    " + TOKEN);
}

/* ── Ortak güvenlik / FS yardımcıları (local-bridge ile aynı sözleşme) ── */
const IGNORED_DIRS = new Set([
  ".git", "node_modules", ".next", "dist", "build", "coverage",
  ".turbo", ".cache", ".vercel", "out", ".idea", ".DS_Store",
]);

function safeResolve(rel) {
  const p = path.resolve(ROOT, rel || ".");
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) {
    throw new Error("Yol kök dizinin dışında: " + rel);
  }
  return p;
}

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

/* ── Komut çalıştırma (ön plan + arka plan görevleri) ── */
const tasks = new Map();

function runBackground(command, cwd) {
  const id = crypto.randomBytes(8).toString("hex");
  const rec = { status: "running", output: "", exitCode: null, startedAt: Date.now(), command };
  tasks.set(id, rec);
  const child = procSpawn(command, { cwd, shell: true });
  const cap = (d) => { rec.output += d.toString(); if (rec.output.length > 500_000) rec.output = rec.output.slice(-500_000); };
  child.stdout.on("data", cap);
  child.stderr.on("data", cap);
  child.on("close", (code) => { rec.status = "done"; rec.exitCode = code; });
  child.on("error", (err) => { rec.status = "error"; rec.output += "\n" + err.message; rec.exitCode = -1; });
  return id;
}

function runForeground(command, cwd) {
  return new Promise((resolve) => {
    const child = procSpawn(command, { cwd, shell: true });
    let out = "";
    const cap = (d) => { out += d.toString(); if (out.length > 500_000) out = out.slice(-500_000); };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    child.on("close", (code) => resolve({ output: out || "(çıktı yok)", exitCode: code }));
    child.on("error", (err) => resolve({ output: "Hata: " + err.message, exitCode: -1 }));
  });
}

/* ── stdio MCP: yerel MCP sunucusunu spawn edip JSON-RPC konuş ── */
function mcpRpc(command, args, env, requests) {
  return new Promise((resolve) => {
    const child = procSpawn(command, args || [], {
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
        try { const msg = JSON.parse(line); if (msg.id != null) responses[msg.id] = msg; }
        catch { /* parçalı/log satırı */ }
      }
      if (requests.every((r) => responses[r.id] !== undefined)) { clearTimeout(timer); done(); }
    });
    child.on("error", () => { clearTimeout(timer); resolve({ error: "spawn edilemedi" }); });
    for (const r of requests) child.stdin.write(JSON.stringify(r) + "\n");
  });
}

/* ── HTTP yardımcıları ── */
function send(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 8_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

function tokenMatch(given) {
  if (!given || given.length !== TOKEN.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN)); } catch { return false; }
}

function authedHttp(req) {
  const h = req.headers["authorization"] || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : "";
  return tokenMatch(bearer || req.headers["x-bridge-token"] || "");
}

/* ── HTTP sunucusu: SUNUCU katmanı (FS + exec + MCP) ── */
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;

  /* /health: kimlik doğrulamasız — uygulama bağlantıyı buradan test eder. */
  if (route === "/health" || route === "/")
    return send(res, 200, { ok: true, root: ROOT, name: "craft-hybrid-bridge", version: "2.0.0", terminal: true });

  if (!authedHttp(req)) return send(res, 401, { error: "Geçersiz veya eksik token." });

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
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-hybrid-bridge", version: "2.0.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        const tools = r[1] && r[1].result && r[1].result.tools ? r[1].result.tools : [];
        return send(res, 200, { tools });
      }
      case "/mcp/call": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-hybrid-bridge", version: "2.0.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: body.tool, arguments: body.arguments || {} } },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        return send(res, 200, { result: r[1] && r[1].result ? r[1].result : { error: "yanıt yok" } });
      }
      default:
        return send(res, 404, { error: "Bilinmeyen uç: " + route });
    }
  } catch (e) {
    return send(res, 200, { error: e.message });
  }
});

/* ── WebSocket: TERMİNAL katmanı (aynı port, upgrade ile) ── */
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  let ok = true;
  if (TOKEN) {
    try { ok = tokenMatch(new URL(req.url, "http://localhost").searchParams.get("token") || ""); }
    catch { ok = false; }
  }
  if (!ok) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  const pty = ptySpawn(SHELL, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.CRAFT_CWD || ROOT,
    env: process.env,
  });
  pty.onData((data) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "output", data })); });
  pty.onExit(() => { try { ws.close(); } catch { /* yok say */ } });
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "input" && typeof msg.data === "string") pty.write(msg.data);
    else if (msg.type === "resize") pty.resize(Math.max(1, msg.cols | 0), Math.max(1, msg.rows | 0));
  });
  ws.on("close", () => { try { pty.kill(); } catch { /* yok say */ } });
  ws.on("error", () => { try { pty.kill(); } catch { /* yok say */ } });
});

server.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log("┌──────────────────────────────────────────────");
  console.log("│ craft.coder HİBRİT köprü çalışıyor (terminal + sunucu)");
  console.log("│ Shell     :", SHELL);
  console.log("│ Workspace :", ROOT);
  console.log("│ Terminal  : ws://" + shown + ":" + PORT + "/?token=" + TOKEN);
  console.log("│ Sunucu    : http://" + shown + ":" + PORT + "  (token: " + TOKEN.slice(0, 4) + "…)");
  console.log("│ → Caddy önünde: wss://<alan>/?token=…  ve  https://<alan>");
  if (!process.env.TOKEN && !process.env.BRIDGE_TOKEN) console.log("│ UYARI: TOKEN env vermedin; üretilen token yukarıda.");
  console.log("└──────────────────────────────────────────────");
});

process.on("SIGINT", () => { try { wss.close(); } catch { /* yok say */ } server.close(); process.exit(0); });
