#!/usr/bin/env node
/* craft.coder — Yerel Gerçek Terminal Köprüsü
 * ------------------------------------------------------------------
 * Bu küçük sunucu, kendi bilgisayarındaki gerçek shell'i (bash/zsh/
 * powershell) bir WebSocket üzerinden craft.coder'a açar. craft içinde
 * Ayarlar → Terminal'e bu adresi (ws://...) yapıştırınca, yapay zekâ
 * gerçek makinende komut çalıştırabilir — tıpkı Claude Code gibi.
 *
 * Tamamen ücretsiz ve senin makinende çalışır; hiçbir veri dışarı çıkmaz.
 *
 * Kurulum:
 *   cd scripts/terminal-bridge
 *   npm install
 *   TOKEN=gizli-bir-anahtar npm start
 *
 * Sonra craft.coder → Ayarlar → Terminal WS URL:
 *   ws://localhost:7777/?token=gizli-bir-anahtar
 *
 * Protokol (RealTerminal ile uyumlu):
 *   İstemci → Sunucu: {type:"input",data}  |  {type:"resize",cols,rows}
 *   Sunucu → İstemci: {type:"output",data}
 * ------------------------------------------------------------------ */
import { WebSocketServer } from "ws";
import { spawn } from "node-pty";
import os from "node:os";

const PORT = Number(process.env.PORT || 7777);
const HOST = process.env.HOST || "127.0.0.1"; // yalnızca yerel; LAN için 0.0.0.0
const TOKEN = process.env.TOKEN || "";
const SHELL =
  process.env.CRAFT_SHELL ||
  (os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash");

const wss = new WebSocketServer({ host: HOST, port: PORT });

const url = `ws://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}${TOKEN ? "/?token=" + TOKEN : ""}`;
console.log("┌──────────────────────────────────────────────");
console.log("│ craft.coder terminal köprüsü çalışıyor");
console.log("│ Shell :", SHELL);
console.log("│ URL   :", url);
console.log("│ → craft.coder Ayarlar → Terminal WS URL'e yapıştır");
if (!TOKEN) console.log("│ UYARI: TOKEN yok. Güvenlik için TOKEN=... ile başlat.");
console.log("└──────────────────────────────────────────────");

wss.on("connection", (ws, req) => {
  // Token doğrulaması — geçersizse 4403 ile kapat (craft bunu anlar).
  if (TOKEN) {
    try {
      const got = new URL(req.url, "http://localhost").searchParams.get("token");
      if (got !== TOKEN) { ws.close(4403, "invalid token"); return; }
    } catch { ws.close(4403, "invalid token"); return; }
  }

  const pty = spawn(SHELL, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.CRAFT_CWD || process.cwd(),
    env: process.env,
  });

  pty.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "output", data }));
  });
  pty.onExit(() => { try { ws.close(); } catch { /* yok say */ } });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "input" && typeof msg.data === "string") {
      pty.write(msg.data);
    } else if (msg.type === "resize") {
      pty.resize(Math.max(1, msg.cols | 0), Math.max(1, msg.rows | 0));
    }
  });

  ws.on("close", () => { try { pty.kill(); } catch { /* yok say */ } });
  ws.on("error", () => { try { pty.kill(); } catch { /* yok say */ } });
});

process.on("SIGINT", () => { wss.close(); process.exit(0); });
