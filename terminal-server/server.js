/**
 * craft.ai — HİBRİT Sunucu (Terminal + Dosya Sistemi)  ⟶  TEK port, TEK token
 *
 * Pazar günü Oracle'da kurduğumuz WebSocket PTY terminal sunucusunun ÜST SÜRÜMÜ.
 * Aynı port (7071) ve aynı TERMINAL_TOKEN üzerinden artık İKİ şey birden sunar:
 *   1) TERMİNAL  (WebSocket)            — gerçek shell (node-pty), birebir eskisi gibi.
 *   2) SUNUCU    (HTTP /fs/*, /exec…)   — gerçek dosya sistemi + komut + MCP.
 *
 * Böylece craft.ai'daki ajan, GitHub/GitLab API yerine bu Oracle sunucusundaki
 * GERÇEK dosyalara yazar (Claude Code gibi) — repo bağlamadan, mobil dahil.
 *
 * GÜNCELLEME (mevcut Oracle kurulumunda):
 *   sudo curl -fsSL <bu-dosyanın-adresi> -o /opt/craftai-terminal/server.js
 *   sudo systemctl restart craftai-terminal
 *   (cloudflared'i KAPATMA → trycloudflare adresin aynı kalır)
 *
 * Uygulama → Ayarlar → 🔗 Hibrit Sunucu: wss://<alan>?token=<token> (ikisini de kurar)
 *
 * Ortam değişkenleri:
 *   PORT            Dinleme portu (varsayılan: 7071)
 *   TERMINAL_TOKEN  Zorunlu erişim şifresi — terminal (?token=) ve sunucu (Bearer) ORTAK
 *   SHELL           Kullanılacak shell (varsayılan: /bin/bash)
 *   WORK_DIR        Kök dizin: terminal cwd + dosya işlemleri (varsayılan: $HOME)
 *   ALLOWED_ORIGIN  CORS izinli origin (varsayılan: * = herkese açık)
 *   MAX_FILE_BYTES  Okuma/yazma üst sınırı (varsayılan: 2_000_000)
 */

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const http = require("http");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "7071", 10);
const TOKEN = process.env.TERMINAL_TOKEN || "";
const SHELL = process.env.SHELL || "/bin/bash";
const WORK_DIR = process.env.WORK_DIR || process.env.HOME || "/root";
const ROOT = path.resolve(WORK_DIR);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_BYTES || "2000000", 10);

if (!TOKEN) {
  console.warn("⚠️  TERMINAL_TOKEN ayarlanmamış — sunucu herkese açık! Lütfen bir token belirle.");
}

/* ════════════════════════════════════════════════════════════════════════
   SUNUCU katmanı yardımcıları (dosya sistemi + komut + MCP)
   ════════════════════════════════════════════════════════════════════════ */
const IGNORED_DIRS = new Set([
  ".git", "node_modules", ".next", "dist", "build", "coverage",
  ".turbo", ".cache", ".vercel", "out", ".idea", ".DS_Store",
]);

/* Yol her zaman ROOT içinde kalmalı (path traversal koruması). */
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

const tasks = new Map();

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
        try { const msg = JSON.parse(line); if (msg.id != null) responses[msg.id] = msg; }
        catch { /* parçalı/log satırı */ }
      }
      if (requests.every((r) => responses[r.id] !== undefined)) { clearTimeout(timer); done(); }
    });
    child.on("error", () => { clearTimeout(timer); resolve({ error: "spawn edilemedi" }); });
    for (const r of requests) child.stdin.write(JSON.stringify(r) + "\n");
  });
}

function sendJson(res, code, obj) {
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

function authedHttp(req) {
  if (!TOKEN) return true;
  const h = req.headers["authorization"] || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : "";
  const given = bearer || req.headers["x-bridge-token"] || "";
  if (given.length !== TOKEN.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN)); } catch { return false; }
}

/* ════════════════════════════════════════════════════════════════════════
   HTTP sunucusu: sağlık + SUNUCU katmanı (FS/exec/MCP)
   ════════════════════════════════════════════════════════════════════════ */
const httpServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url ?? "/", "http://localhost");
  const route = url.pathname;

  /* Sağlık uçları — kimlik doğrulamasız (mevcut /  davranışı KORUNUR). */
  if (req.method === "GET" && route === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("craft.ai terminal server OK");
    return;
  }
  if (route === "/health") {
    return sendJson(res, 200, { ok: true, name: "craftai-terminal-hybrid", version: "2.0.0", terminal: true, root: ROOT });
  }

  /* Buradan sonrası SUNUCU katmanı → token zorunlu. */
  if (!authedHttp(req)) return sendJson(res, 401, { error: "Geçersiz veya eksik token." });

  try {
    if (route === "/exec/status" && req.method === "GET") {
      const rec = tasks.get(url.searchParams.get("id") || "");
      if (!rec) return sendJson(res, 404, { error: "Görev bulunamadı" });
      return sendJson(res, 200, rec);
    }

    const body = req.method === "POST" ? await readBody(req) : {};

    switch (route) {
      case "/fs/list": {
        let paths = await walk(ROOT, []);
        const f = (body.filter || "").toLowerCase();
        if (f) paths = paths.filter((p) => p.toLowerCase().includes(f));
        return sendJson(res, 200, { paths: paths.slice(0, 5000) });
      }
      case "/fs/read": {
        const p = safeResolve(body.path);
        const st = await fsp.stat(p);
        if (st.size > MAX_FILE_BYTES) return sendJson(res, 200, { error: `Dosya çok büyük (${st.size} bayt)` });
        return sendJson(res, 200, { content: await fsp.readFile(p, "utf-8") });
      }
      case "/fs/write": {
        const p = safeResolve(body.path);
        let created = false;
        try { await fsp.access(p); } catch { created = true; }
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.writeFile(p, String(body.content ?? ""), "utf-8");
        return sendJson(res, 200, { ok: true, created });
      }
      case "/fs/delete": {
        const p = safeResolve(body.path);
        await fsp.rm(p, { recursive: true, force: true });
        return sendJson(res, 200, { ok: true });
      }
      case "/fs/rename": {
        const from = safeResolve(body.path);
        const to = safeResolve(body.newPath);
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.rename(from, to);
        return sendJson(res, 200, { ok: true });
      }
      case "/fs/glob": {
        const re = globToRegExp(body.pattern || "**");
        const paths = (await walk(ROOT, [])).filter((p) => re.test(p));
        return sendJson(res, 200, { paths: paths.slice(0, 2000) });
      }
      case "/fs/grep": {
        let re;
        try { re = new RegExp(body.pattern, body.ignoreCase ? "i" : ""); }
        catch (e) { return sendJson(res, 200, { error: "Geçersiz regex: " + e.message }); }
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
        return sendJson(res, 200, { matches });
      }
      case "/exec": {
        const command = String(body.command || "").trim();
        if (!command) return sendJson(res, 200, { error: "command zorunlu" });
        const cwd = body.cwd ? safeResolve(body.cwd) : ROOT;
        if (body.background) return sendJson(res, 200, { taskId: runBackground(command, cwd) });
        return sendJson(res, 200, await runForeground(command, cwd));
      }
      case "/mcp/list": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craftai-terminal-hybrid", version: "2.0.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        const tools = r[1] && r[1].result && r[1].result.tools ? r[1].result.tools : [];
        return sendJson(res, 200, { tools });
      }
      case "/mcp/call": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craftai-terminal-hybrid", version: "2.0.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: body.tool, arguments: body.arguments || {} } },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        return sendJson(res, 200, { result: r[1] && r[1].result ? r[1].result : { error: "yanıt yok" } });
      }
      default:
        return sendJson(res, 404, { error: "Bilinmeyen uç: " + route });
    }
  } catch (e) {
    return sendJson(res, 200, { error: e.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════
   WebSocket: TERMİNAL katmanı (birebir eski davranış — DEĞİŞMEDİ)
   ════════════════════════════════════════════════════════════════════════ */
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const reqUrl = new URL(req.url ?? "/", `http://localhost`);
  const token = reqUrl.searchParams.get("token") || "";

  if (TOKEN && token !== TOKEN) {
    ws.close(4403, "Unauthorized");
    console.log(`[AUTH] Reddedilen bağlantı: ${req.socket.remoteAddress}`);
    return;
  }

  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGIN !== "*" && origin && origin !== ALLOWED_ORIGIN) {
    ws.close(4403, "Origin not allowed");
    return;
  }

  console.log(`[CONNECT] ${req.socket.remoteAddress} bağlandı`);

  let cols = 80, rows = 24;
  const proc = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: ROOT,
    env: { ...process.env, TERM: "xterm-256color" },
  });

  proc.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "output", data }));
    }
  });

  proc.onExit(({ exitCode }) => {
    console.log(`[EXIT] Shell çıktı (${exitCode})`);
    if (ws.readyState === ws.OPEN) ws.close();
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "input" && typeof msg.data === "string") {
        proc.write(msg.data);
      } else if (msg.type === "resize" && msg.cols && msg.rows) {
        cols = msg.cols;
        rows = msg.rows;
        proc.resize(cols, rows);
      }
    } catch {
      proc.write(raw.toString());
    }
  });

  ws.on("close", () => {
    console.log(`[DISCONNECT] ${req.socket.remoteAddress} ayrıldı`);
    try { proc.kill(); } catch { /* already dead */ }
  });

  ws.on("error", (err) => {
    console.error(`[WS ERROR] ${err.message}`);
    try { proc.kill(); } catch { /* ignore */ }
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n✅ craft.ai HİBRİT Sunucu çalışıyor (terminal + dosya sistemi)`);
  console.log(`   Port      : ${PORT}`);
  console.log(`   Shell     : ${SHELL}`);
  console.log(`   Workspace : ${ROOT}`);
  console.log(`   Auth      : ${TOKEN ? "✓ Token aktif" : "⚠ Token YOK"}`);
  console.log(`\n   Ayarlar → 🔗 Hibrit Sunucu:`);
  console.log(`   wss://<alan>${TOKEN ? `?token=${TOKEN}` : ""}   (terminal + Yerel Mod otomatik)\n`);
});
