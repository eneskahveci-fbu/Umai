// @ts-check
/**
 * Craft.Coder Headless SDK
 * ------------------------
 * Çalışan bir Craft.Coder sunucusunun (`/api/chat`) önüne geçen, bağımlılıksız
 * (Node 18+ yerleşik `fetch`) programatik istemci. Tarayıcı/UI olmadan ajanı
 * sürer: model yapılandırmasını ve (opsiyonel) bir Local Bridge'i verirsiniz,
 * ajan gerçek dosya sistemi + kabuk üzerinde çok-adımlı görev yürütür.
 *
 * Mimari: sunucu dosya okuma/yazma/düzenlemeyi köprü üzerinden KENDİSİ yapar;
 * yalnızca `run_command` istemciye olay olarak gelir. Bu SDK o komutları
 * köprünün `/exec` ucunda çalıştırıp çıktıyı sonraki tura geri besler — tıpkı
 * web arayüzünün yaptığı gibi (bkz. CoderView terminal-output döngüsü).
 *
 * Kullanım:
 *   import { streamAgent, runAgent } from "./craftcoder.mjs";
 *   for await (const ev of streamAgent({ prompt, model, apiKey, baseUrl, bridge })) { ... }
 *   const { text } = await runAgent({ prompt, model, apiKey, baseUrl });
 */

/**
 * @typedef {Object} BridgeConfig
 * @property {string} url   - Local Bridge adresi (ör. http://localhost:4319)
 * @property {string} [token] - Köprü erişim token'ı
 */

/**
 * @typedef {Object} AgentOptions
 * @property {string}  prompt           - Kullanıcı talimatı
 * @property {string}  baseUrl          - LLM API tabanı (OpenAI-uyumlu)
 * @property {string}  model            - Model adı
 * @property {string}  [apiKey]         - API anahtarı (Pollinations için boş olabilir)
 * @property {string}  [provider]       - Sağlayıcı kimliği (openrouter, groq, anthropic, local…)
 * @property {string}  [appUrl]         - Craft.Coder sunucu tabanı (varsayılan http://localhost:3000)
 * @property {string}  [systemPrompt]   - Sistem yönergesi eki
 * @property {BridgeConfig} [bridge]    - Yerel dosya/kabuk erişimi → araçları açar
 * @property {boolean} [tools]          - Araçları zorla aç/kapat (varsayılan: bridge varsa açık)
 * @property {number}  [maxTurns]       - run_command geri-besleme döngüsü üst sınırı (varsayılan 12)
 * @property {number}  [temperature]
 * @property {number}  [maxTokens]
 * @property {"low"|"medium"|"high"|"max"} [effort]
 * @property {Array<{role:string,content:string}>} [messages] - Önceki mesajlar (gelişmiş; verilirse prompt eklenir)
 * @property {(msg:string)=>void} [onLog] - Tanılama günlüğü (varsayılan: sessiz)
 */

/**
 * @typedef {Object} AgentEvent
 * @property {"text"|"reasoning"|"tool"|"command"|"turn-end"|"warning"|"done"} type
 * @property {string} [text]
 * @property {string} [name]
 * @property {"start"|"end"} [phase]
 * @property {string} [command]
 * @property {string} [output]
 * @property {string} [reason]
 * @property {number} [turn]
 */

const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_MAX_TURNS = 12;

/**
 * Köprünün gerçek kabuğunda tek bir komut çalıştırır (eşzamanlı).
 * @param {BridgeConfig} bridge
 * @param {string} command
 * @returns {Promise<string>}
 */
export async function execOnBridge(bridge, command) {
  const base = bridge.url.replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridge.token || ""}` },
      body: JSON.stringify({ command }),
    });
    const d = await r.json();
    if (typeof d.error === "string") return `Hata: ${d.error}`;
    return String(d.output ?? "").slice(0, 8000);
  } catch (e) {
    return `Yerel köprüye ulaşılamadı: ${/** @type {Error} */ (e).message}`;
  }
}

/**
 * Tek bir /api/chat isteğini akıtır; ham SSE olaylarını çözüp normalize eder.
 * Metni biriktirir, çalıştırılacak komutları ve bitiş nedenini toplar.
 * @param {string} appUrl
 * @param {Record<string, unknown>} body
 * @param {(ev: AgentEvent) => void} emit
 * @returns {Promise<{ text: string; commands: string[]; finishReason: string }>}
 */
async function streamOneRequest(appUrl, body, emit) {
  const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`/api/chat ${res.status}: ${detail.slice(0, 300)}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  /** @type {string[]} */
  const commands = [];
  let finishReason = "stop";

  for await (const chunk of /** @type {AsyncIterable<Uint8Array>} */ (res.body)) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    // SSE olayları "\n\n" ile ayrılır; tampondaki tamamlanmış olayları işle.
    while ((nl = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      for (const line of rawEvent.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }

        const delta = parsed?.choices?.[0]?.delta;
        if (delta?.content) { text += delta.content; emit({ type: "text", text: delta.content }); }
        if (delta?.reasoning) emit({ type: "reasoning", text: delta.reasoning });

        if (parsed.tool_event) {
          const te = parsed.tool_event;
          emit({ type: "tool", phase: te.phase, name: te.name, text: te.result ? String(te.result) : undefined });
        }
        if (parsed.run_command_event?.command) {
          commands.push(String(parsed.run_command_event.command));
        }
        if (parsed.finish_event?.reason) finishReason = String(parsed.finish_event.reason);
      }
    }
  }
  return { text, commands, finishReason };
}

/**
 * Ajanı uçtan uca sürer; normalize edilmiş olayları akıtan async generator.
 * Araçlar (köprü) açıksa run_command çıktısını sonraki tura geri besler ve
 * model işi bitirene (veya maxTurns'e) kadar döngüyü sürdürür.
 * @param {AgentOptions} opts
 * @returns {AsyncGenerator<AgentEvent, void, unknown>}
 */
export async function* streamAgent(opts) {
  if (!opts.prompt && !(opts.messages && opts.messages.length)) throw new Error("`prompt` zorunlu.");
  if (!opts.baseUrl || !opts.model) throw new Error("`baseUrl` ve `model` zorunlu.");

  const appUrl = opts.appUrl || DEFAULT_APP_URL;
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
  const toolsOn = opts.tools ?? !!opts.bridge;
  const log = opts.onLog || (() => {});

  /** @type {Array<{role:string,content:string}>} */
  const messages = [...(opts.messages || [])];
  if (opts.prompt) messages.push({ role: "user", content: opts.prompt });

  const repoCtx = opts.bridge
    ? {
        owner: "local", repo: "local", branch: "main", provider: "local",
        bridgeUrl: opts.bridge.url, bridgeToken: opts.bridge.token,
      }
    : undefined;

  /** @type {AgentEvent[]} */
  let queued = [];
  const emit = (/** @type {AgentEvent} */ ev) => { queued.push(ev); };

  for (let turn = 0; turn < maxTurns; turn++) {
    const body = {
      messages,
      baseUrl: opts.baseUrl, model: opts.model, apiKey: opts.apiKey || "",
      provider: opts.provider, systemPrompt: opts.systemPrompt,
      tools: toolsOn && !!repoCtx,
      terminalAvailable: !!opts.bridge,
      temperature: opts.temperature, maxTokens: opts.maxTokens, effort: opts.effort,
      repoCtx: toolsOn ? repoCtx : undefined,
    };

    log(`tur ${turn + 1}/${maxTurns} → /api/chat`);
    const { text, commands, finishReason } = await streamOneRequest(appUrl, body, emit);
    // streamOneRequest senkron `emit` ile kuyruğa yazdı; sırayla akıt.
    for (const ev of queued) yield ev;
    queued = [];

    messages.push({ role: "assistant", content: text || "(araçlar çalıştırıldı)" });
    yield { type: "turn-end", reason: finishReason, turn: turn + 1 };

    // 1) Ajan komut çalıştırmak istedi → köprüde çalıştır, çıktıyı geri besle.
    if (commands.length) {
      if (!opts.bridge) {
        yield { type: "warning", text: "Ajan komut çalıştırmak istedi ama köprü tanımlı değil; durduruluyor." };
        yield { type: "done", text };
        return;
      }
      const blocks = [];
      for (const command of commands) {
        const output = await execOnBridge(opts.bridge, command);
        yield { type: "command", command, output };
        blocks.push(`**Terminal çıktısı** (\`${command}\`):\n\`\`\`\n${output || "(çıktı yok)"}\n\`\`\``);
      }
      messages.push({ role: "user", content: blocks.join("\n\n") });
      continue;
    }

    // 2) Yanıt token sınırında kesildi → kaldığı yerden sürdür.
    if (finishReason === "length") {
      messages.push({ role: "user", content: "Devam et." });
      continue;
    }

    // 3) Doğal bitiş.
    yield { type: "done", text };
    return;
  }

  yield { type: "warning", text: `Tur sınırına ulaşıldı (maxTurns=${maxTurns}).` };
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  yield { type: "done", text: last?.content || "" };
}

/**
 * Kolaylık sarmalayıcı: ajanı sonuna kadar çalıştırıp toplanmış metni döndürür.
 * @param {AgentOptions} opts
 * @returns {Promise<{ text: string; commands: Array<{command:string,output:string}> }>}
 */
export async function runAgent(opts) {
  let text = "";
  /** @type {Array<{command:string,output:string}>} */
  const commands = [];
  for await (const ev of streamAgent(opts)) {
    if (ev.type === "text") text += ev.text;
    else if (ev.type === "command") commands.push({ command: ev.command || "", output: ev.output || "" });
    else if (ev.type === "done" && !text) text = ev.text || "";
  }
  return { text, commands };
}
