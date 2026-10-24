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
 *   TERMINAL_TOKEN  ZORUNLU erişim şifresi — terminal (?token=) ve sunucu (Bearer) ORTAK
 *   SHELL           Kullanılacak shell (varsayılan: /bin/bash)
 *   WORK_DIR        Kök dizin: terminal cwd + dosya işlemleri (varsayılan: $HOME)
 *   ALLOWED_ORIGIN  CORS izinli origin (varsayılan: * = herkese açık)
 *   MAX_FILE_BYTES  Okuma/yazma üst sınırı (varsayılan: 2_000_000)
 *   MAX_BODY_BYTES  HTTP gövde üst sınırı (varsayılan: 8_000_000)
 *   EXEC_TIMEOUT_MS Senkron komut zaman aşımı (varsayılan: 120_000)
 *   MAX_TASKS       Arka plan görev üst sınırı (varsayılan: 50)
 *   ALLOW_INSECURE  "1" → TERMINAL_TOKEN olmadan da başlat (yalnız geliştirme!)
 *
 * GÜVENLİK NOTU (2026-10 sertleştirme):
 *   - TERMINAL_TOKEN yoksa sunucu ARTIK BAŞLAMAZ (eskiden uyarı basıp dünyaya
 *     açık bir root shell olarak devam ediyordu). Geliştirme için ALLOW_INSECURE=1.
 *   - Yol çözümleme `realpath` tabanlı: workspace içindeki bir symlink ile kök
 *     dizin dışına çıkılamaz (eski `startsWith` kontrolü bunu kaçırıyordu).
 *   - WebSocket token karşılaştırması timing-safe; token loglara yazılmıyor.
 *   - Senkron komutlar EXEC_TIMEOUT_MS sonunda öldürülür; arka plan görevleri
 *     TTL ile temizlenir (eskiden harita sınırsız büyüyordu).
 *   - Hatalar doğru HTTP durum koduyla döner (eskiden hepsi 200'dü).
 *
 * UYARI: `/exec` ve `/mcp/*` bilinçli olarak keyfi komut çalıştırır — bu sunucu
 * token'ı bilen herkese tam kabuk erişimi verir. İnternete açıkken token'ı
 * güçlü tut ve yalnızca güvendiğin istemcilere ver.
 */

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "7071", 10);
const TOKEN = process.env.TERMINAL_TOKEN || "";
const SHELL = process.env.SHELL || "/bin/bash";
const WORK_DIR = process.env.WORK_DIR || process.env.HOME || "/root";
const ROOT = path.resolve(WORK_DIR);
/* Symlink karşılaştırmaları için kökün GERÇEK yolu. */
const ROOT_REAL = (() => {
  try { return fs.realpathSync(ROOT); } catch { return ROOT; }
})();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_BYTES || "2000000", 10);
const MAX_BODY_BYTES = parseInt(process.env.MAX_BODY_BYTES || "8000000", 10);
const EXEC_TIMEOUT_MS = parseInt(process.env.EXEC_TIMEOUT_MS || "120000", 10);
const MAX_TASKS = parseInt(process.env.MAX_TASKS || "50", 10);
const TASK_TTL_MS = 60 * 60 * 1000;
const ALLOW_INSECURE = process.env.ALLOW_INSECURE === "1";

/* Token ZORUNLU: yoksa açık bir root shell olarak başlamak yerine dur. */
if (!TOKEN) {
  if (ALLOW_INSECURE) {
    console.warn("⚠️  ALLOW_INSECURE=1 — TERMINAL_TOKEN yok, sunucu KİMLİK DOĞRULAMASIZ çalışıyor (yalnız geliştirme!).");
  } else {
    console.error("✖ TERMINAL_TOKEN ayarlanmamış. Sunucu başlatılmadı.");
    console.error("  Kalıcı bir token üret:  openssl rand -hex 24");
    console.error("  Sonra: TERMINAL_TOKEN=<token> node server.js");
    console.error("  (Geliştirme için bilinçli olarak: ALLOW_INSECURE=1)");
    process.exit(1);
  }
} else if (TOKEN.length < 16) {
  console.warn("⚠️  TERMINAL_TOKEN çok kısa (<16 karakter) — daha uzun bir token önerilir.");
}

/* ════════════════════════════════════════════════════════════════════════
   SUNUCU katmanı yardımcıları (dosya sistemi + komut + MCP)
   ════════════════════════════════════════════════════════════════════════ */
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

/* Yol her zaman ROOT içinde kalmalı (path traversal + symlink koruması).
   Yol adım adım çözülür; her symlink hedefi de denetlenir. Böylece workspace
   içine yerleştirilmiş bir symlink (`disari -> /etc`) kök dışına çıkamaz.
   Hedefi henüz var olmayan (dangling) symlink'ler de reddedilir. */
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

function tokenMatches(given) {
  if (!TOKEN) return true; // yalnız ALLOW_INSECURE modunda
  if (typeof given !== "string" || given.length !== TOKEN.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN)); } catch { return false; }
}

function authedHttp(req) {
  const h = req.headers["authorization"] || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : "";
  return tokenMatches(bearer || req.headers["x-bridge-token"] || "");
}

/* Origin kontrolü — ALLOWED_ORIGIN=* değilse tarayıcı isteklerini de süz. */
function originAllowed(req) {
  if (ALLOWED_ORIGIN === "*") return true;
  const o = req.headers.origin;
  return !o || o === ALLOWED_ORIGIN;
}

/* ════════════════════════════════════════════════════════════════════════
   HTTP sunucusu: sağlık + SUNUCU katmanı (FS/exec/MCP)
   ════════════════════════════════════════════════════════════════════════ */
const httpServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url ?? "/", "http://localhost");
  const route = url.pathname;

  /* Sağlık uçları — kimlik doğrulamasız (mevcut /  davranışı KORUNUR) ama
     artık sunucunun disk yolunu SIZDIRMAZ. */
  if (req.method === "GET" && route === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("craft.ai terminal server OK");
    return;
  }
  if (route === "/health") {
    return sendJson(res, 200, {
      ok: true,
      name: "craftai-terminal-hybrid",
      version: "2.1.0",
      terminal: true,
      ...(authedHttp(req) ? { root: ROOT } : {}),
    });
  }

  if (!originAllowed(req)) return sendJson(res, 403, { error: "Origin izinli değil." });

  /* Buradan sonrası SUNUCU katmanı → token zorunlu. */
  if (!authedHttp(req)) return sendJson(res, 401, { error: "Geçersiz veya eksik token." });

  try {
    if (route === "/exec/status") {
      if (req.method !== "GET") return sendJson(res, 405, { error: "Bu uç yalnız GET kabul eder." });
      const rec = tasks.get(url.searchParams.get("id") || "");
      if (!rec) return sendJson(res, 404, { error: "Görev bulunamadı" });
      return sendJson(res, 200, rec);
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "Bu uç yalnız POST kabul eder." });
    const body = await readBody(req);

    switch (route) {
      case "/fs/list": {
        let paths = await walk(ROOT, []);
        const f = (body.filter || "").toLowerCase();
        if (f) paths = paths.filter((p) => p.toLowerCase().includes(f));
        return sendJson(res, 200, { paths: paths.slice(0, 5000) });
      }
      case "/fs/read": {
        const p = await safeResolve(body.path);
        const st = await fsp.stat(p);
        if (!st.isFile()) throw new HttpError(400, "Okunacak yol bir dosya değil.");
        if (st.size > MAX_FILE_BYTES) throw new HttpError(413, `Dosya çok büyük (${st.size} bayt)`);
        return sendJson(res, 200, { content: await fsp.readFile(p, "utf-8") });
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
        return sendJson(res, 200, { ok: true, created });
      }
      case "/fs/delete": {
        const p = await safeResolve(body.path);
        if (p === ROOT_REAL || p === ROOT) throw new HttpError(400, "Kök dizin silinemez.");
        await fsp.rm(p, { recursive: true, force: true });
        return sendJson(res, 200, { ok: true });
      }
      case "/fs/rename": {
        const from = await safeResolve(body.path);
        const to = await safeResolve(body.newPath);
        if (to === ROOT_REAL || to === ROOT) throw new HttpError(400, "Kök dizin hedef olamaz.");
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
        return sendJson(res, 200, { matches });
      }
      case "/exec": {
        const command = String(body.command || "").trim();
        if (!command) throw new HttpError(400, "command zorunlu");
        const cwd = body.cwd ? await safeResolve(body.cwd) : ROOT;
        if (body.background) return sendJson(res, 200, { taskId: runBackground(command, cwd) });
        const result = await runForeground(command, cwd);
        if (result.timedOut) return sendJson(res, 504, result);
        return sendJson(res, 200, result);
      }
      case "/mcp/list": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craftai-terminal-hybrid", version: "2.1.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        if (r.error) throw new HttpError(502, r.error);
        const tools = r[1] && r[1].result && r[1].result.tools ? r[1].result.tools : [];
        return sendJson(res, 200, { tools });
      }
      case "/mcp/call": {
        const reqs = [
          { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craftai-terminal-hybrid", version: "2.1.0" } } },
          { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: body.tool, arguments: body.arguments || {} } },
        ];
        const r = await mcpRpc(body.command, body.args, body.env, reqs);
        if (r.error) throw new HttpError(502, r.error);
        return sendJson(res, 200, { result: r[1] && r[1].result ? r[1].result : { error: "yanıt yok" } });
      }
      default:
        return sendJson(res, 404, { error: "Bilinmeyen uç: " + route });
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error(`[HATA] ${req.method} ${route}:`, e && e.message ? e.message : e);
    return sendJson(res, status, { error: e && e.message ? e.message : "Bilinmeyen hata" });
  }
});

/* ════════════════════════════════════════════════════════════════════════
   WebSocket: TERMİNAL katmanı (davranış aynı; auth timing-safe)
   ════════════════════════════════════════════════════════════════════════ */
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const reqUrl = new URL(req.url ?? "/", `http://localhost`);
  const token = reqUrl.searchParams.get("token") || "";

  if (!tokenMatches(token)) {
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
  console.log(`   Auth      : ${TOKEN ? "✓ Token aktif" : "⚠ TOKEN YOK (ALLOW_INSECURE)"}`);
  console.log(`   Komut zaman aşımı: ${EXEC_TIMEOUT_MS} ms`);
  console.log(`\n   Ayarlar → 🔗 Hibrit Sunucu:`);
  /* Token'ı loglara YAZMA — journald/proxy loglarına sızmasın. */
  console.log(`   wss://<alan>?token=<TERMINAL_TOKEN>   (terminal + Yerel Mod otomatik)\n`);
});
