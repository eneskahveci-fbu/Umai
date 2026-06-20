#!/usr/bin/env node
/* Craft Coder CLI — terminalde Claude Code gibi çalışan AI kod ajanı.
 *
 * Herhangi bir OpenAI-uyumlu modelle (DeepSeek, Qwen, Gemini, Groq, Pollinations,
 * Anthropic…) çalışır. Araç döngüsü model-agnostiktir: model bir `craft` JSON
 * bloğu yayar, CLI aracı yerelde çalıştırır, sonucu geri verir — fonksiyon-çağrı
 * desteği gerektirmez, ücretsiz modellerde de çalışır.
 *
 * Komutlar:
 *   craft-coder              → interaktif ajan (REPL)
 *   craft-coder "görev..."   → tek seferlik görev
 *   craft-coder config       → model/anahtar ayarla (~/.craft-coder/config.json)
 *   craft-coder bridge       → web uygulamasına köprü (gerçek terminal + FS)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";

const HOME = os.homedir();
const DIR = path.join(HOME, ".craft-coder");
const CFG = path.join(DIR, "config.json");
const C = { b: "\x1b[38;2;200;168;126m", g: "\x1b[32m", r: "\x1b[31m", d: "\x1b[2m", bold: "\x1b[1m", z: "\x1b[0m" };

function loadConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CFG, "utf8")); } catch { /* yok */ }
  return {
    baseUrl: process.env.CRAFT_BASE_URL || c.baseUrl || "https://text.pollinations.ai/openai",
    apiKey: process.env.CRAFT_API_KEY || c.apiKey || "",
    model: process.env.CRAFT_MODEL || c.model || "openai",
    provider: process.env.CRAFT_PROVIDER || c.provider || "",
  };
}
function saveConfig(c) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(CFG, JSON.stringify(c, null, 2));
  fs.chmodSync(CFG, 0o600);
}
function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

/* ── Araçlar (yerelde, kullanıcının cwd'sinde) ─────────────────────────── */
const ROOT = process.cwd();
function safe(p) {
  const abs = path.resolve(ROOT, p || ".");
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw new Error("Yol proje dışında: " + p);
  return abs;
}
const TOOLS = {
  list_files({ dir = "." }) {
    const base = safe(dir);
    const out = [];
    const walk = (d, depth) => {
      if (depth > 4) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if ([".git", "node_modules", ".next", "dist", "build", ".cache"].includes(e.name)) continue;
        const full = path.join(d, e.name);
        out.push(path.relative(ROOT, full) + (e.isDirectory() ? "/" : ""));
        if (e.isDirectory() && out.length < 800) walk(full, depth + 1);
      }
    };
    walk(base, 0);
    return out.slice(0, 800).join("\n") || "(boş)";
  },
  read_file({ path: p }) {
    const t = fs.readFileSync(safe(p), "utf8");
    return t.length > 30000 ? t.slice(0, 30000) + "\n…(kesildi)" : t;
  },
  write_file({ path: p, content }) {
    const abs = safe(p);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content ?? "");
    return "yazıldı: " + p;
  },
  grep({ pattern, path: p = "." }) {
    const re = new RegExp(pattern, "i");
    const hits = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if ([".git", "node_modules", ".next", "dist", "build"].includes(e.name)) continue;
        const full = path.join(d, e.name);
        if (e.isDirectory()) { if (hits.length < 200) walk(full); continue; }
        let txt = ""; try { txt = fs.readFileSync(full, "utf8"); } catch { continue; }
        txt.split("\n").forEach((line, i) => {
          if (hits.length < 200 && re.test(line)) hits.push(`${path.relative(ROOT, full)}:${i + 1}: ${line.trim().slice(0, 160)}`);
        });
      }
    };
    walk(safe(p));
    return hits.join("\n") || "(eşleşme yok)";
  },
  async run_command({ command }) {
    const okAns = await ask(`${C.r}⚠ Komut çalıştırılsın mı?${C.z} ${C.bold}${command}${C.z} [y/N] `);
    if (okAns.toLowerCase() !== "y") return "(kullanıcı reddetti)";
    const r = spawnSync(command, { shell: true, cwd: ROOT, encoding: "utf8", timeout: 120000 });
    return ((r.stdout || "") + (r.stderr || "")).slice(0, 12000) || `(çıkış kodu ${r.status})`;
  },
};

const SYSTEM = `Sen Craft Coder, terminalde çalışan deneyimli bir yazılım ajanısın (Claude Code gibi).
Kullanıcının PROJESİNDE (cwd) gerçek dosyalarla çalışırsın. Türkçe, net ve kısa konuş.

ARAÇ KULLANIMI: Bir araç çağırmak için yanıtın SADECE şu blok olsun (başka metin yok):
\`\`\`craft
{"tool":"read_file","path":"src/x.ts"}
\`\`\`
Araçlar:
- list_files {"dir":"."}            → dosya ağacı
- read_file  {"path":"..."}         → dosya oku
- write_file {"path":"...","content":"..."} → dosya yaz/oluştur
- grep       {"pattern":"...","path":"."}   → içerik ara
- run_command{"command":"..."}      → kabuk komutu (kullanıcı onaylar)
Her turda EN FAZLA BİR araç çağır. Sonucu sana geri veririm; sonra devam et.
Önce keşfet (list_files/read_file/grep), SONRA değiştir. İş bitince araç bloğu OLMADAN
normal cevabını yaz (özet + ne yaptığın).`;

function extractAction(text) {
  const m = /```craft\s*([\s\S]*?)```/i.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return { _bad: m[1].trim() }; }
}

async function callModel(cfg, messages) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.provider === "anthropic") { headers["x-api-key"] = cfg.apiKey; headers["anthropic-version"] = "2023-06-01"; }
  else if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  const body = { model: cfg.model, messages, stream: false };
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Model hatası ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function agent(cfg, history, userText) {
  history.push({ role: "user", content: userText });
  const messages = [{ role: "system", content: SYSTEM }, ...history];
  for (let step = 0; step < 24; step++) {
    let reply;
    try { reply = await callModel(cfg, messages); }
    catch (e) { console.log(`${C.r}✗ ${e.message}${C.z}`); return; }
    const action = extractAction(reply);
    if (!action) {
      console.log(`\n${C.b}✦${C.z} ${reply.trim()}\n`);
      history.push({ role: "assistant", content: reply });
      return;
    }
    messages.push({ role: "assistant", content: reply });
    if (action._bad || !TOOLS[action.tool]) {
      messages.push({ role: "user", content: `Araç sonucu: Geçersiz araç çağrısı. Geçerli araçlardan birini kullan.` });
      continue;
    }
    const argStr = action.path || action.command || action.dir || action.pattern || "";
    console.log(`${C.d}  🔧 ${action.tool}${argStr ? " " + String(argStr).slice(0, 80) : ""}${C.z}`);
    let result;
    try { result = await TOOLS[action.tool](action); }
    catch (e) { result = "Hata: " + e.message; }
    messages.push({ role: "user", content: `Araç sonucu (${action.tool}):\n${result}` });
  }
  console.log(`${C.r}(adım limiti aşıldı)${C.z}`);
}

/* ── Giriş noktaları ───────────────────────────────────────────────────── */
async function cmdConfig() {
  const cur = loadConfig();
  console.log(`${C.b}Craft Coder ayarları${C.z} ${C.d}(boş bırak = değiştirme)${C.z}`);
  const baseUrl = (await ask(`Base URL [${cur.baseUrl}]: `)) || cur.baseUrl;
  const model = (await ask(`Model [${cur.model}]: `)) || cur.model;
  const apiKey = (await ask(`API anahtarı [${cur.apiKey ? "•••• var" : "yok"}]: `)) || cur.apiKey;
  saveConfig({ baseUrl, model, apiKey });
  console.log(`${C.g}✓ Kaydedildi:${C.z} ${CFG}`);
}

async function repl(cfg) {
  console.log(`${C.b}✦ Craft Coder${C.z} ${C.d}— ${cfg.model} @ ${new URL(cfg.baseUrl).host} · cwd: ${ROOT}${C.z}`);
  console.log(`${C.d}  Görevini yaz. Çıkış: Ctrl+C  ·  ayar: craft-coder config${C.z}\n`);
  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${C.b}› ${C.z}` });
  rl.prompt();
  rl.on("line", async (line) => {
    const t = line.trim();
    if (!t) return rl.prompt();
    if (t === "/exit" || t === "/quit") return rl.close();
    rl.pause();
    await agent(cfg, history, t);
    rl.resume();
    rl.prompt();
  });
  rl.on("close", () => { console.log(`${C.d}görüşürüz.${C.z}`); process.exit(0); });
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === "config") return cmdConfig();
  if (cmd === "bridge") {
    const bridge = path.join(DIR, "bridge.mjs");
    if (!fs.existsSync(bridge)) { console.log(`${C.r}Köprü kurulu değil. install.sh çalıştır.${C.z}`); process.exit(1); }
    const r = spawnSync(process.execPath, [bridge], { stdio: "inherit", cwd: ROOT });
    process.exit(r.status ?? 0);
  }
  const cfg = loadConfig();
  if (cfg.provider !== "pollinations" && !cfg.apiKey && !cfg.baseUrl.includes("pollinations")) {
    console.log(`${C.b}İlk kurulum:${C.z} model + anahtar gerekli.`);
    await cmdConfig();
    return main();
  }
  if (cmd) return agent(cfg, [], [cmd, ...rest].join(" "));
  return repl(cfg);
}
main().catch((e) => { console.error(`${C.r}${e.message}${C.z}`); process.exit(1); });
