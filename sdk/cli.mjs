#!/usr/bin/env node
// @ts-check
/**
 * Craft.Coder Headless CLI — `claude -p` benzeri tek-atış ajan çalıştırıcı.
 *
 * Çalışan bir Craft.Coder sunucusuna (varsayılan http://localhost:3000) bağlanır,
 * isteğe bağlı bir Local Bridge ile gerçek dosya sistemi + kabuğa erişir ve
 * görevi başsız (UI'sız) yürütür. Asistan metni stdout'a, araç/komut izleri
 * stderr'e yazılır → çıktıyı boru hattında (pipe) güvenle kullanabilirsiniz.
 *
 * Örnekler:
 *   node sdk/cli.mjs "README'yi özetle"
 *   node sdk/cli.mjs -p "auth.ts'e rate-limit ekle" --bridge-url http://localhost:4319 --bridge-token GIZLI
 *   echo "testleri çalıştır ve düzelt" | node sdk/cli.mjs --json
 *
 * Yapılandırma ortam değişkenlerinden de okunur (bayrak öncelikli):
 *   CRAFTCODER_APP_URL, CRAFTCODER_BASE_URL, CRAFTCODER_MODEL, CRAFTCODER_API_KEY,
 *   CRAFTCODER_PROVIDER, CRAFTCODER_BRIDGE_URL, CRAFTCODER_BRIDGE_TOKEN
 */

import { streamAgent } from "./craftcoder.mjs";

const HELP = `Craft.Coder Headless CLI

Kullanım:
  craftcoder [seçenekler] "<istem>"
  echo "<istem>" | craftcoder [seçenekler]

Seçenekler:
  -p, --prompt <metin>     İstem (konumsal argüman veya stdin ile de verilebilir)
      --app-url <url>      Craft.Coder sunucusu (vars. http://localhost:3000)
      --base-url <url>     LLM API tabanı (OpenAI-uyumlu)        [CRAFTCODER_BASE_URL]
      --model <ad>         Model adı                              [CRAFTCODER_MODEL]
      --api-key <anahtar>  API anahtarı                           [CRAFTCODER_API_KEY]
      --provider <ad>      Sağlayıcı (openrouter, groq, anthropic, local…)
      --system <metin>     Sistem yönergesi eki
      --bridge-url <url>   Local Bridge adresi → dosya/kabuk araçlarını açar
      --bridge-token <t>   Köprü erişim token'ı
      --max-turns <n>      run_command geri-besleme döngüsü sınırı (vars. 12)
      --no-tools           Köprü olsa bile araçları kapat (yalnız sohbet)
      --json               Olayları JSONL olarak stdout'a yaz (programatik kullanım)
  -q, --quiet              Araç/komut izlerini gizle (yalnız asistan metni)
  -h, --help               Bu yardımı göster

Çıkış kodu: başarı 0, hata 1.
`;

/** Basit argüman ayrıştırıcı (bağımlılıksız). */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const takeVal = (key) => { out[key] = argv[++i]; };
    switch (a) {
      case "-h": case "--help": out.help = true; break;
      case "-q": case "--quiet": out.quiet = true; break;
      case "--json": out.json = true; break;
      case "--no-tools": out.noTools = true; break;
      case "-p": case "--prompt": takeVal("prompt"); break;
      case "--app-url": takeVal("appUrl"); break;
      case "--base-url": takeVal("baseUrl"); break;
      case "--model": takeVal("model"); break;
      case "--api-key": takeVal("apiKey"); break;
      case "--provider": takeVal("provider"); break;
      case "--system": takeVal("system"); break;
      case "--bridge-url": takeVal("bridgeUrl"); break;
      case "--bridge-token": takeVal("bridgeToken"); break;
      case "--max-turns": takeVal("maxTurns"); break;
      default:
        if (a.startsWith("-")) { console.error(`Bilinmeyen seçenek: ${a}`); process.exit(2); }
        positional.push(a);
    }
  }
  if (!out.prompt && positional.length) out.prompt = positional.join(" ");
  return out;
}

/** stdin boruyla bağlıysa tümünü oku (etkileşimli TTY ise atla). */
async function readStdin() {
  if (process.stdin.isTTY) return "";
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) data += chunk;
  return data.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP); return; }

  const env = process.env;
  let prompt = /** @type {string} */ (args.prompt) || "";
  if (!prompt) prompt = await readStdin();
  if (!prompt) { console.error("Hata: istem yok. `craftcoder \"...\"` veya stdin kullanın. (-h yardım)"); process.exit(1); }

  const baseUrl = /** @type {string} */ (args.baseUrl) || env.CRAFTCODER_BASE_URL || "";
  const model = /** @type {string} */ (args.model) || env.CRAFTCODER_MODEL || "";
  if (!baseUrl || !model) {
    console.error("Hata: --base-url ve --model gerekli (veya CRAFTCODER_BASE_URL / CRAFTCODER_MODEL).");
    process.exit(1);
  }
  const bridgeUrl = /** @type {string} */ (args.bridgeUrl) || env.CRAFTCODER_BRIDGE_URL || "";
  const bridge = bridgeUrl
    ? { url: bridgeUrl, token: /** @type {string} */ (args.bridgeToken) || env.CRAFTCODER_BRIDGE_TOKEN || "" }
    : undefined;

  const json = !!args.json;
  const quiet = !!args.quiet;
  const emitJson = (ev) => process.stdout.write(JSON.stringify(ev) + "\n");
  const trace = (s) => { if (!quiet) process.stderr.write(s); };

  /** @type {import("./craftcoder.mjs").AgentOptions} */
  const opts = {
    prompt,
    appUrl: /** @type {string} */ (args.appUrl) || env.CRAFTCODER_APP_URL || undefined,
    baseUrl, model,
    apiKey: /** @type {string} */ (args.apiKey) || env.CRAFTCODER_API_KEY || "",
    provider: /** @type {string} */ (args.provider) || env.CRAFTCODER_PROVIDER || undefined,
    systemPrompt: /** @type {string} */ (args.system) || undefined,
    bridge,
    tools: args.noTools ? false : undefined,
    maxTurns: args.maxTurns ? Number(args.maxTurns) : undefined,
    onLog: (m) => trace(`\x1b[90m[${m}]\x1b[0m\n`),
  };

  try {
    for await (const ev of streamAgent(opts)) {
      if (json) { emitJson(ev); continue; }
      switch (ev.type) {
        case "text": process.stdout.write(ev.text || ""); break;
        case "tool":
          if (ev.phase === "start") trace(`\x1b[36m▶ ${ev.name}\x1b[0m\n`);
          else if (ev.text) trace(`\x1b[32m✓ ${ev.name}\x1b[0m ${ev.text.slice(0, 120)}\n`);
          break;
        case "command": trace(`\x1b[35m$ ${ev.command}\x1b[0m\n${(ev.output || "").slice(0, 2000)}\n`); break;
        case "warning": trace(`\x1b[33m⚠ ${ev.text}\x1b[0m\n`); break;
        case "turn-end": break;
        case "done": process.stdout.write("\n"); break;
      }
    }
  } catch (e) {
    const msg = /** @type {Error} */ (e).message;
    if (json) emitJson({ type: "error", text: msg });
    else console.error(`\n\x1b[31mHata:\x1b[0m ${msg}`);
    process.exit(1);
  }
}

main();
