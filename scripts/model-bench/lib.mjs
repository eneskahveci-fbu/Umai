/* Model test tezgâhı — ortak yardımcılar.
   Modellere OpenAI-uyumlu /chat/completions ile (Anthropic için yerel /messages)
   çağrı yapar; anahtarlar YALNIZ çalışma anında dosyadan/ortamdan okunur, hiçbir
   yere yazılmaz ve depoya girmez. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function tmpDir(prefix = "bench-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function runNode(args, { cwd, timeout = 20000, input } = {}) {
  const r = spawnSync(process.execPath, args, { cwd, timeout, encoding: "utf8", input, env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  return { code: r.status ?? (r.signal ? 124 : 1), out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

/** Cevaptan kod bloğu çıkar: istenen dilde en uzun blok; yoksa herhangi bir blok; yoksa düz metin. */
export function extractCode(text, langs = []) {
  const blocks = [...String(text).matchAll(/```([a-zA-Z0-9_+-]*)[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1].toLowerCase(), code: m[2] }));
  const pick = (arr) => arr.sort((a, b) => b.code.length - a.code.length)[0]?.code;
  if (langs.length) {
    const hit = pick(blocks.filter((b) => langs.includes(b.lang)));
    if (hit) return hit;
  }
  const any = pick(blocks);
  if (any) return any;
  return String(text);
}

export function extractJson(text) {
  const t = String(text);
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(t);
  const cand = fenced ? fenced[1] : t;
  const start = cand.search(/[\[{]/);
  if (start < 0) throw new Error("JSON bulunamadı");
  const open = cand[start];
  const close = open === "{" ? "}" : "]";
  const end = cand.lastIndexOf(close);
  if (end <= start) throw new Error("JSON kapanmıyor");
  return JSON.parse(cand.slice(start, end + 1));
}

/* ─── Model çağrısı ─── */
/* Aynı uca (baseUrl) yapılan çağrılar arasında en az `minIntervalMs` bekle — anahtarsız
   uçların dakika sınırına (ör. OVH anonim 2 istek/dk) takılmamak için. */
const lastCall = new Map();
const chain = new Map();
function throttle(key, minMs) {
  if (!minMs) return Promise.resolve();
  const prev = chain.get(key) ?? Promise.resolve();
  const next = prev.then(async () => {
    const wait = (lastCall.get(key) ?? 0) + minMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall.set(key, Date.now());
  });
  chain.set(key, next.catch(() => {}));
  return next;
}

async function post(url, headers, body, timeoutMs, minIntervalMs = 0) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle(new URL(url).host, minIntervalMs);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
      const txt = await res.text();
      if (res.ok) return JSON.parse(txt);
      last = new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`);
      if (res.status !== 429 && res.status < 500) throw last;
    } catch (e) {
      last = e.name === "AbortError" ? new Error(`zaman aşımı (${timeoutMs / 1000}s)`) : e;
      if (/^HTTP 4\d\d/.test(last.message) && !/^HTTP 429/.test(last.message)) throw last;
    } finally {
      clearTimeout(t);
    }
    await sleep(/^HTTP 429/.test(last?.message ?? "") ? 30000 : 1500 * 2 ** attempt);
  }
  throw last;
}

function toAnthropic(messages) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const out = [];
  const push = (role, blocks) => {
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") push("user", [{ type: "text", text: m.content }]);
    else if (m.role === "assistant") {
      const blocks = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls ?? []) blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments || "{}") });
      if (!blocks.length) blocks.push({ type: "text", text: "…" });
      push("assistant", blocks);
    } else if (m.role === "tool") push("user", [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }]);
  }
  return { system, messages: out };
}

/** m: { provider, baseUrl, model, apiKey, maxTokens? } → { text, toolCalls, message, ms, usage } */
export async function callModel(m, messages, { tools, timeoutMs = 240000 } = {}) {
  const t0 = Date.now();
  const key = m.apiKey ?? (m.apiKeyEnv ? process.env[m.apiKeyEnv] : undefined);
  if (m.provider === "anthropic") {
    const { system, messages: msgs } = toAnthropic(messages);
    const body = { model: m.model, max_tokens: m.maxTokens ?? 8192, temperature: 0.2, system, messages: msgs };
    if (tools?.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    const j = await post(`${m.baseUrl.replace(/\/$/, "")}/messages`, { "x-api-key": key, "anthropic-version": "2023-06-01" }, body, timeoutMs, m.minIntervalMs);
    const text = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const toolCalls = (j.content ?? []).filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} }));
    return {
      text, toolCalls, ms: Date.now() - t0,
      usage: { in: j.usage?.input_tokens ?? 0, out: j.usage?.output_tokens ?? 0 },
      message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) },
    };
  }
  const body = { model: m.model, messages, temperature: 0.2, max_tokens: m.maxTokens ?? 8192 };
  if (tools?.length) { body.tools = tools.map((t) => ({ type: "function", function: t })); body.tool_choice = "auto"; }
  const headers = key ? { authorization: `Bearer ${key}` } : {};
  const j = await post(`${m.baseUrl.replace(/\/$/, "")}/chat/completions`, headers, body, timeoutMs, m.minIntervalMs);
  const msg = j.choices?.[0]?.message ?? {};
  const toolCalls = (msg.tool_calls ?? []).map((c) => {
    let args = {};
    try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* bozuk argüman */ }
    return { id: c.id ?? `call_${Math.random().toString(36).slice(2, 8)}`, name: c.function?.name, args };
  });
  const text = typeof msg.content === "string" ? msg.content : "";
  return {
    text, toolCalls, ms: Date.now() - t0,
    usage: { in: j.usage?.prompt_tokens ?? 0, out: j.usage?.completion_tokens ?? 0 },
    message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) },
  };
}

/* ─── Tarayıcı (Playwright) ─── */
let browserP;
export async function getBrowser() {
  if (!browserP) {
    browserP = import("playwright").then(({ chromium }) => {
      const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
      return chromium.launch({ executablePath: exe });
    });
  }
  return browserP;
}
export async function closeBrowser() {
  if (browserP) { const b = await browserP; await b.close(); browserP = undefined; }
}

/** HTML'i geçici dosyaya yazıp aç; sayfa hatalarını topla; fn(page, errors) çalıştır. */
export async function withPage(html, fn) {
  const dir = tmpDir("page-");
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, html);
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  // Dış ağ isteklerini kes: tek dosyalık, kütüphanesiz çıktı istendi.
  await page.route(/^https?:/, (r) => { errors.push(`dış istek: ${r.request().url()}`); return r.abort(); });
  try {
    await page.goto(`file://${file}`);
    await page.waitForTimeout(150);
    return await fn(page, errors, `file://${file}`);
  } finally {
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Tek-turlu görev tanımı için küçük yardımcı. */
export function result(pass, score, notes) {
  return { pass, score, notes };
}
