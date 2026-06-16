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

const HELP = `Craft.Coder CLI

Kullanım:
  craft-coder                       Etkileşimli sohbet (Claude Code tarzı, craft teması)
  craft-coder [seçenekler] "<istem>"  Tek-atış (başsız) çalıştırma
  echo "<istem>" | craft-coder [seçenekler]

Argümansız çalıştırınca etkileşimli arayüz açılır (sıfır yapılandırma: ücretsiz
Pollinations modeli + herkese açık sunucu). Kendi modelin için --base-url/--model.

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

/* ── Craft teması (truecolor amber) ───────────────────────────────────────── */
const C = {
  amber: (s) => `\x1b[38;2;200;168;126m${s}\x1b[0m`,
  amberB: (s) => `\x1b[1;38;2;200;168;126m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

/* Sıfır-yapılandırmayla çalışsın: ücretsiz Pollinations + herkese açık sunucu.
   Kullanıcı bayrak/env ile kendi modelini/anahtarını verebilir. */
const DEFAULTS = {
  appUrl: "https://craft-coder.vercel.app",
  baseUrl: "https://text.pollinations.ai/openai",
  model: "openai",
  provider: "pollinations",
};

function banner() {
  const line = "─".repeat(40);
  process.stdout.write(
    C.amber(`╭${line}╮\n`) +
    C.amber("│ ") + C.amberB("◆ Craft.Coder") + C.dim("  · AI kod asistanı") + C.amber("            │\n") +
    C.amber(`╰${line}╯\n`) +
    C.dim("  /help yardım · /yeni sıfırla · /çık veya Ctrl+C çıkış\n\n"),
  );
}

/* Etkileşimli sohbet döngüsü (Claude Code tarzı, craft temalı). */
async function interactive(baseOpts) {
  const readline = await import("node:readline");
  banner();
  process.stdout.write(
    C.dim(`  Model: ${baseOpts.provider}/${baseOpts.model}` +
      (baseOpts.bridge ? "  · 🔌 yerel köprü açık (dosya/komut)" : "  · (köprü yok: yalnız sohbet)") + "\n\n"),
  );

  /** @type {Array<{role:string,content:string}>} */
  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise((res) => rl.question(C.amberB("❯ "), res));

  for (;;) {
    const input = (await ask()).trim();
    if (!input) continue;
    if (input === "/çık" || input === "/quit" || input === "/exit") break;
    if (input === "/yeni" || input === "/clear" || input === "/new") { history.length = 0; process.stdout.write(C.dim("  (sohbet sıfırlandı)\n")); continue; }
    if (input === "/help" || input === "/yardım") {
      process.stdout.write(C.dim(
        "  Komutlar:\n" +
        "    /yeni    sohbeti sıfırla\n" +
        "    /çık     çıkış\n" +
        "    /help    bu yardım\n" +
        "  Kendi modelin: --base-url/--model/--api-key veya CRAFTCODER_* env.\n",
      ));
      continue;
    }

    let assistant = "";
    try {
      for await (const ev of streamAgent({ ...baseOpts, prompt: input, messages: history })) {
        switch (ev.type) {
          case "text": assistant += ev.text || ""; process.stdout.write(C.amber(ev.text || "")); break;
          case "tool": if (ev.phase === "start") process.stdout.write(C.dim(`\n  ▶ ${ev.name}\n`)); break;
          case "command": process.stdout.write(C.dim(`\n  $ ${ev.command}\n`) + C.dim((ev.output || "").slice(0, 1500)) + "\n"); break;
          case "warning": process.stdout.write(C.red(`\n  ⚠ ${ev.text}\n`)); break;
          case "done": process.stdout.write("\n\n"); break;
        }
      }
    } catch (e) {
      process.stdout.write(C.red(`\n  Hata: ${(e).message}\n\n`));
      continue;
    }
    history.push({ role: "user", content: input });
    history.push({ role: "assistant", content: assistant || "(araçlar çalıştırıldı)" });
  }
  rl.close();
  process.stdout.write(C.dim("  Görüşürüz!\n"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP); return; }

  const env = process.env;
  const bridgeUrl = /** @type {string} */ (args.bridgeUrl) || env.CRAFTCODER_BRIDGE_URL || "";
  const bridge = bridgeUrl
    ? { url: bridgeUrl, token: /** @type {string} */ (args.bridgeToken) || env.CRAFTCODER_BRIDGE_TOKEN || "" }
    : undefined;

  const json = !!args.json;
  const quiet = !!args.quiet;
  const emitJson = (ev) => process.stdout.write(JSON.stringify(ev) + "\n");
  const trace = (s) => { if (!quiet) process.stderr.write(s); };

  /* Sıfır-config: bayrak > env > ücretsiz varsayılan (Pollinations + açık sunucu). */
  const baseOpts = {
    appUrl: /** @type {string} */ (args.appUrl) || env.CRAFTCODER_APP_URL || DEFAULTS.appUrl,
    baseUrl: /** @type {string} */ (args.baseUrl) || env.CRAFTCODER_BASE_URL || DEFAULTS.baseUrl,
    model: /** @type {string} */ (args.model) || env.CRAFTCODER_MODEL || DEFAULTS.model,
    apiKey: /** @type {string} */ (args.apiKey) || env.CRAFTCODER_API_KEY || "",
    provider: /** @type {string} */ (args.provider) || env.CRAFTCODER_PROVIDER || DEFAULTS.provider,
    systemPrompt: /** @type {string} */ (args.system) || undefined,
    bridge,
    tools: args.noTools ? false : undefined,
    maxTurns: args.maxTurns ? Number(args.maxTurns) : undefined,
    onLog: (m) => trace(`\x1b[90m[${m}]\x1b[0m\n`),
  };

  let prompt = /** @type {string} */ (args.prompt) || "";
  if (!prompt) prompt = await readStdin();
  /* İstem yok + etkileşimli terminal → Claude Code tarzı sohbet arayüzü. */
  if (!prompt) {
    if (process.stdin.isTTY && !json) { await interactive(baseOpts); return; }
    console.error("Hata: istem yok. `craft-coder \"...\"` veya stdin kullanın. (-h yardım)");
    process.exit(1);
  }

  /** @type {import("./craftcoder.mjs").AgentOptions} */
  const opts = { ...baseOpts, prompt };

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
