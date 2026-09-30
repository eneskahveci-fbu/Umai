#!/usr/bin/env node
/* craft.coder — Hibrit Köprü (Terminal + Sunucu + Yerel LLM)  ⟶  TEK port, TEK token
 * ════════════════════════════════════════════════════════════════════════
 * Bu köprü, craft.coder'ı tıpkı Claude Code gibi GERÇEK bir ortamda çalıştırır.
 * Tek bir adres (wss:// + token) üzerinden ÜÇ şey birden sunar:
 *
 *   1) TERMİNAL  (WebSocket /)              — gerçek shell (node-pty), canlı.
 *   2) SUNUCU    (HTTP /fs/*, /exec…)       — gerçek dosya sistemi + komut + MCP.
 *   3) YEREL LLM (HTTP /llm/v1/*)           — bu sunucudaki Ollama'ya OpenAI-uyumlu
 *      proxy (bkz. deploy/oracle/setup-llm.sh). Ollama YALNIZ 127.0.0.1'de dinler,
 *      dışarıya hiç açılmaz — köprünün KENDİ token doğrulamasından geçmeden
 *      erişilemez. craft.ai tarafında normal bir "Özel" sağlayıcı gibi eklenir:
 *      Base URL = https://<alan>/llm/v1, Anahtar = köprü token'ı, Model = ör.
 *      qwen2.5:14b-instruct-q4_K_M. Sunucudan (Vercel /api/chat) normal bir
 *      OpenAI-uyumlu uca gitmekten farksız — köprüye özel bir istemci kodu YOK.
 *
 * Böylece:
 *   • Vercel'deki site             → bu köprüye bağlanır (Faz 4 hibrit).
 *   • Mobil Safari/Firefox dahil   → WebContainer GEREKMEZ; her şey sunucuda.
 *   • Repo bağlamak ZORUNLU değil   → kalıcı workspace dizini her zaman hazır.
 *   • Pollinations'tan çok daha güçlü bir model, tamamen KENDİ sunucunda,
 *     üçüncü tarafa hiç veri gitmeden, gerçek anlamda ücretsiz (Oracle Always
 *     Free) çalışır.
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
 *   OLLAMA_URL    Yerel Ollama adresi        (varsayılan http://127.0.0.1:11434)
 *   MCP_CONFIG    Kalıcı yerel MCP sunucuları (varsayılan: bridge.mjs yanındaki
 *                 mcp-servers.json) — ör. {"laya": {"command": "…/laya-mcp-server"}}.
 *                 Her biri köprüyle BİRLİKTE bir kez başlar, açık kalır ve
 *                 https://<alan>/mcp/local/<ad> adresinden craft.ai'nın normal
 *                 HTTP MCP istemcisine sunulur (Ayarlar → Eklentiler; başlık:
 *                 Authorization: Bearer <token>). Bkz. deploy/oracle/setup-laya.sh.
 *
 * Güvenlik: HTTP token (Bearer/X-Bridge-Token) + WS token (?token=). Tek kullanıcı
 * (root değil) ile çalıştır. Yol her zaman WORK_DIR içinde kalır (path traversal yok).
 * ════════════════════════════════════════════════════════════════════════ */
import { WebSocketServer } from "ws";
import { spawn as ptySpawn } from "node-pty";
import { spawn as procSpawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 7777);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.resolve(process.env.WORK_DIR || process.cwd());
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_BYTES || "2000000", 10);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
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
  /* detached: süreci KENDİ süreç grubunda başlat → /exec/kill grubun tamamını
     (kabuk + altındaki gerçek program) sonlandırabilir. Olmadan yalnız `sh`
     ölür, `npm run dev`in başlattığı node süreci yetim kalıp yaşamaya devam
     ederdi (port meşgul kalır). */
  const child = procSpawn(command, { cwd, shell: true, detached: true });
  /* Süreç referansı kayıtta TUTULUR ama enumerable DEĞİL: /exec/status yanıtı
     JSON.stringify'dan geçtiği için serileştirmeye girmemeli. */
  Object.defineProperty(rec, "_child", { value: child, enumerable: false });
  const cap = (d) => { rec.output += d.toString(); if (rec.output.length > 500_000) rec.output = rec.output.slice(-500_000); };
  child.stdout.on("data", cap);
  child.stderr.on("data", cap);
  /* `exited`: sürecin GERÇEKTEN bittiğini gösteren tek güvenilir işaret.
     killBackground'daki SIGKILL yükseltmesi buna bakar — `rec.status`a
     bakılamaz, çünkü kill isteği status'u hemen "killed" yapıyor ve
     yükseltme koşulu asla tutmuyordu (SIGKILL hiç gönderilmiyordu). */
  Object.defineProperty(rec, "_exited", { value: false, writable: true, enumerable: false });
  child.on("close", (code) => { rec._exited = true; rec.status = rec.status === "killed" ? "killed" : "done"; rec.exitCode = code; });
  child.on("error", (err) => { rec._exited = true; rec.status = "error"; rec.output += "\n" + err.message; rec.exitCode = -1; });
  return id;
}

/** Arka plan görevini (ve altındaki TÜM süreç grubunu) sonlandırır.
    Önce SIGTERM (nazik kapanış şansı), ölmezse SIGKILL. Bu yükseltme
    ŞART: canlı testte `sh -c "node …"` grubu SIGTERM'den sağ çıktı,
    yalnız SIGKILL ile öldü — tek başına SIGTERM'e güvenmek, durdurulduğu
    sanılan bir dev sunucusunun portu tutmaya devam etmesi demekti. */
function killBackground(id) {
  const rec = tasks.get(id);
  if (!rec) return { error: "Görev bulunamadı" };
  if (rec.status !== "running") return { ok: true, alreadyStopped: true, status: rec.status };
  const child = rec._child;
  if (!child || typeof child.pid !== "number") return { error: "Süreç referansı yok" };
  try {
    /* Negatif pid = süreç GRUBU (detached ile mümkün). */
    process.kill(-child.pid, "SIGTERM");
  } catch (e) {
    /* ESRCH: grup zaten yok (yarış) — hata değil, başarı say. */
    if (e.code !== "ESRCH") return { error: e.message };
    rec._exited = true;
  }
  if (!rec._exited) {
    setTimeout(() => {
      if (rec._exited) return;
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* çoktan öldü */ }
    }, 3000);
  }
  rec.status = "killed";
  return { ok: true };
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
    for (const r of requests) {
      child.stdin.write(JSON.stringify(r) + "\n");
      /* MCP spesifikasyonu: initialize yanıtından sonra istemci
         "notifications/initialized" gönderir. Mevcut SDK'lar (mcp 2.2 dahil)
         eksikliğini tolere ediyor ama katı sunucular için gönderiyoruz. */
      if (r.method === "initialize") child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    }
  });
}

/* ── Kalıcı yerel MCP sunucuları ──
   mcpRpc her çağrıda süreci baştan başlatır; model yükleyen sunucular (ör. Laya
   ~400M parametreyi belleğe alır) için bu her çağrıda saniyeler demek ve
   craft.ai'nın 5-15 sn MCP zaman aşımına takılır. Burada sunucu köprüyle bir
   kez başlar, açık kalır; istekler id ile eşlenir. Komutlar YALNIZ sunucudaki
   yapılandırma dosyasından okunur (istek gövdesinden asla). */
const MCP_CONFIG_PATH =
  process.env.MCP_CONFIG || path.join(path.dirname(fileURLToPath(import.meta.url)), "mcp-servers.json");
const MCP_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/i;
const MCP_INIT_TIMEOUT_MS = 10 * 60_000; // ilk açılışta model ağırlıkları inebilir
const persistentMcp = new Map();

async function loadMcpConfig() {
  try {
    const cfg = JSON.parse(await fsp.readFile(MCP_CONFIG_PATH, "utf-8"));
    return cfg && typeof cfg === "object" ? cfg : {};
  } catch { return {}; }
}

function startPersistentMcp(name, spec) {
  const child = procSpawn(spec.command, Array.isArray(spec.args) ? spec.args : [], {
    cwd: ROOT,
    env: { ...process.env, ...(spec.env || {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const st = { child, pending: new Map(), nextId: 1, alive: true, stderr: "", tools: null, ready: null };
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const p = msg.id != null ? st.pending.get(msg.id) : null;
      if (p) { st.pending.delete(msg.id); clearTimeout(p.timer); p.resolve(msg); }
    }
  });
  child.stderr.on("data", (d) => { st.stderr = (st.stderr + d.toString()).slice(-4000); });
  const die = (why) => {
    if (!st.alive) return;
    st.alive = false;
    for (const p of st.pending.values()) { clearTimeout(p.timer); p.resolve({ error: { message: why } }); }
    st.pending.clear();
    if (persistentMcp.get(name) === st) persistentMcp.delete(name); // sonraki istek yeniden başlatır
    console.log(`[mcp:${name}] ${why}`);
  };
  child.on("exit", (code) => die(`kapandı (kod ${code}). ${st.stderr.slice(-400)}`));
  child.on("error", (e) => die("başlatılamadı: " + e.message));
  st.request = (method, params, timeoutMs) => new Promise((resolve) => {
    if (!st.alive) return resolve({ error: { message: `MCP sunucusu "${name}" çalışmıyor` } });
    const id = st.nextId++;
    const timer = setTimeout(() => { st.pending.delete(id); resolve({ error: { message: `zaman aşımı (${method})` } }); }, timeoutMs);
    st.pending.set(id, { resolve, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} }) + "\n");
  });
  st.ready = (async () => {
    const init = await st.request("initialize", {
      protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "craft-hybrid-bridge", version: "2.1.0" },
    }, MCP_INIT_TIMEOUT_MS);
    if (init.error) throw new Error(init.error.message || "initialize başarısız");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    console.log(`[mcp:${name}] hazır`);
  })();
  st.ready.catch((e) => console.log(`[mcp:${name}] ${e.message}`));
  persistentMcp.set(name, st);
  return st;
}

async function getPersistentMcp(name) {
  if (!MCP_NAME_RE.test(name)) return null;
  const running = persistentMcp.get(name);
  if (running) return running;
  const spec = (await loadMcpConfig())[name];
  if (!spec || typeof spec.command !== "string" || !spec.command) return null;
  return startPersistentMcp(name, spec);
}

/* Hazır olmasını en fazla `ms` bekle — craft.ai'nın kendi zaman aşımından önce
   anlamlı bir hata dönebilmek için. */
function waitReady(st, ms) {
  return Promise.race([
    st.ready.then(() => null, (e) => e.message),
    new Promise((r) => setTimeout(() => r("hâlâ hazırlanıyor (ilk açılışta model indiriliyor olabilir) — biraz sonra tekrar dene"), ms)),
  ]);
}

/* craft.ai'nın HTTP MCP istemcisi: POST <url>/tools/list | <url>/tools/call,
   gövde JSON-RPC; yanıttan result.tools / result.content okur. */
async function handleLocalMcp(name, op, body) {
  const rpcId = body && body.id != null ? body.id : 1;
  const fail = (message) => ({ jsonrpc: "2.0", id: rpcId, error: { code: -32000, message } });
  const st = await getPersistentMcp(name);
  if (!st) return fail(`Yerel MCP sunucusu bulunamadı: "${name}" (${MCP_CONFIG_PATH})`);
  if (op === "list") {
    if (st.tools) return { jsonrpc: "2.0", id: rpcId, result: { tools: st.tools } };
    const notReady = await waitReady(st, 4000);
    if (notReady) return fail(notReady);
    const r = await st.request("tools/list", {}, 4000);
    if (r.error) return fail(r.error.message || "tools/list başarısız");
    st.tools = (r.result && r.result.tools) || [];
    return { jsonrpc: "2.0", id: rpcId, result: { tools: st.tools } };
  }
  const params = (body && body.params) || {};
  if (typeof params.name !== "string") return fail("tools/call: araç adı eksik");
  const notReady = await waitReady(st, 10_000);
  if (notReady) return fail(notReady);
  const r = await st.request("tools/call", { name: params.name, arguments: params.arguments || {} }, 13_000);
  if (r.error) return fail(r.error.message || "tools/call başarısız");
  return { jsonrpc: "2.0", id: rpcId, result: r.result };
}

/* Köprüyle birlikte yapılandırılmış sunucuları ısıt (ilk istek beklemesin). */
loadMcpConfig().then((cfg) => {
  for (const [name, spec] of Object.entries(cfg)) {
    if (MCP_NAME_RE.test(name) && spec && typeof spec.command === "string") startPersistentMcp(name, spec);
  }
});

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
    return send(res, 200, { ok: true, root: ROOT, name: "craft-hybrid-bridge", version: "2.2.0", terminal: true });

  if (!authedHttp(req)) return send(res, 401, { error: "Geçersiz veya eksik token." });

  try {
    if (route === "/exec/status" && req.method === "GET") {
      const rec = tasks.get(url.searchParams.get("id") || "");
      if (!rec) return send(res, 404, { error: "Görev bulunamadı" });
      return send(res, 200, rec);
    }

    const body = req.method === "POST" ? await readBody(req) : {};

    if (route === "/exec/kill") {
      return send(res, 200, killBackground(String(body.id || "")));
    }

    const localMcp = route.match(/^\/mcp\/local\/([^/]+)\/tools\/(list|call)$/);
    if (localMcp && req.method === "POST") {
      return send(res, 200, await handleLocalMcp(decodeURIComponent(localMcp[1]), localMcp[2], body));
    }

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
        const content = String(body.content ?? "");
        /* MAX_FILE_BYTES yorumu "okuma/YAZMA üst sınırı" diyor ama yazma
           yolu hiç kontrol etmiyordu — /fs/read'in AYNI sınırı (231. satır)
           burada da uygulanmalı, yoksa bu uç sınırsız boyutta içeriği
           doğrudan diske yazar (disk taşması/DoS). */
        const bytes = Buffer.byteLength(content, "utf-8");
        if (bytes > MAX_FILE_BYTES) return send(res, 200, { error: `İçerik çok büyük (${bytes} bayt)` });
        let created = false;
        try { await fsp.access(p); } catch { created = true; }
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.writeFile(p, content, "utf-8");
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
      /* Yerel LLM (Ollama) proxy — craft.ai bunu düz bir OpenAI-uyumlu "Özel"
         sağlayıcı gibi görür (bkz. dosya başındaki blok). Ollama'nın kendisi
         asla dışarıya açılmaz; buraya ulaşan istek zaten authedHttp()'ten
         geçmiş olur. Akışlı (SSE) yanıtlar olduğu gibi pipe'lanır. */
      case "/llm/v1/chat/completions": {
        let upstream;
        try {
          upstream = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch (e) {
          return send(res, 200, { error: "Yerel model sunucusuna (Ollama) ulaşılamadı: " + e.message });
        }
        res.writeHead(upstream.status, {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Token",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        });
        if (!upstream.body) { res.end(); return; }
        Readable.fromWeb(upstream.body).pipe(res);
        return;
      }
      case "/llm/v1/models": {
        try {
          const upstream = await fetch(`${OLLAMA_URL}/v1/models`);
          const data = await upstream.json().catch(() => ({ data: [] }));
          return send(res, upstream.status, data);
        } catch (e) {
          return send(res, 200, { error: "Yerel model sunucusuna (Ollama) ulaşılamadı: " + e.message });
        }
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

/* Terminal ortamı:
   - Kullanıcı-alanı kurulum dizinleri PATH'in BAŞINA eklenir. opencode/bun/pip
     --user/npm prefix gibi kurucular root gerektirmeden ~/.xxx/bin'e yazar ama
     .bashrc'ye ekleyemeyebilir (ör. `opencode` kurulup "command not found").
     Burada baştan eklendiği için reboot/yeniden bağlanma sonrası da çalışır.
     Var olmayan dizinler PATH'i kirletmesin diye yalnız mevcut olanlar eklenir
     (her bağlantıda yeniden bakılır → sonradan kurulan araç da görünür).
   - TERM=xterm-256color + COLORTERM=truecolor: istemci xterm.js tam renk
     destekler; eski "xterm-color" 8 renge düşürüyordu (opencode gibi TUI'ler
     soluk/bozuk görünüyordu). */
function ptyEnv() {
  const home = process.env.HOME || os.homedir();
  const extra = [".opencode/bin", ".local/bin", ".bun/bin", ".npm-global/bin", ".cargo/bin", "go/bin"]
    .map((d) => path.join(home, d))
    .filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
  const basePath = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
  const parts = basePath.split(path.delimiter);
  const PATH = [...extra.filter((d) => !parts.includes(d)), ...parts].join(path.delimiter);
  return { ...process.env, PATH, TERM: "xterm-256color", COLORTERM: "truecolor", LANG: process.env.LANG || "C.UTF-8" };
}

wss.on("connection", (ws) => {
  /* xterm-256color + truecolor: opencode gibi tam ekran TUI'ler 8 renkli
     "xterm-color"da bozuk/soluk görünür; istemci (xterm.js) 24-bit rengi destekler. */
  const pty = ptySpawn(SHELL, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.CRAFT_CWD || ROOT,
    env: ptyEnv(), // TERM/COLORTERM + PATH (opencode/bun/cargo…) — GitLab sürümü, benim ayarımın üst kümesi
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
  /* Sade çıktı: sunucu içyapısını (kabuk, workspace yolu) dökme; bağlantı
     adresini YALNIZ BİR kez göster (uygulamaya yapıştırmak için gerekli). */
  console.log("\n  Craft Coder köprüsü çalışıyor.");
  console.log("  Uygulamada Ayarlar -> Hibrit Sunucu alanina yapistir:");
  console.log("    ws://" + shown + ":" + PORT + "/?token=" + TOKEN + "\n");
});

process.on("SIGINT", () => { try { wss.close(); } catch { /* yok say */ } server.close(); process.exit(0); });
