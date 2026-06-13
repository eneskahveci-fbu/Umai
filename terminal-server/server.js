/**
 * craft.ai — WebSocket PTY Terminal Sunucusu
 *
 * Kurulum (herhangi bir Linux sunucuda):
 *   npm install
 *   TERMINAL_TOKEN=gizli_sifre node server.js
 *
 * Oracle Cloud Free Tier kurulumu:
 *   1. cloud.oracle.com → Start for free (kredi kartı gerekli ama ücret alınmaz)
 *   2. ARM VM oluştur: Shape = VM.Standard.A1.Flex, 1 OCPU, 6 GB RAM
 *   3. Security List → port 7071 aç (TCP Ingress)
 *   4. SSH ile bağlan, bu dizini kopyala, npm install && node server.js
 *   5. Uygulama ayarları → Terminal Sunucusu: wss://IP:7071?token=SIFRE
 *
 * Cloudflare Tunnel (hesap gerekmez, kendi bilgisayarın):
 *   1. brew/winget ile cloudflared kur
 *   2. cloudflared tunnel --url ws://localhost:7071
 *   3. Verilen *.trycloudflare.com URL'ini kullan (wss://xxx.trycloudflare.com)
 *
 * Ortam değişkenleri:
 *   PORT            Dinleme portu (varsayılan: 7071)
 *   TERMINAL_TOKEN  Zorunlu erişim şifresi — boş bırakma!
 *   SHELL           Kullanılacak shell (varsayılan: /bin/bash)
 *   WORK_DIR        Başlangıç dizini (varsayılan: $HOME)
 *   ALLOWED_ORIGIN  CORS izinli origin (varsayılan: * = herkese açık)
 */

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const http = require("http");

const PORT = parseInt(process.env.PORT || "7071", 10);
const TOKEN = process.env.TERMINAL_TOKEN || "";
const SHELL = process.env.SHELL || "/bin/bash";
const WORK_DIR = process.env.WORK_DIR || process.env.HOME || "/root";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

if (!TOKEN) {
  console.warn("⚠️  TERMINAL_TOKEN ayarlanmamış — sunucu herkese açık! Lütfen bir token belirle.");
}

/* ── HTTP health check endpoint ─────────────────────────────────────
   GET / → 200 OK (Render, Railway, Oracle LB health check için) */
const httpServer = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("craft.ai terminal server OK");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  /* ── Kimlik doğrulama ── */
  const reqUrl = new URL(req.url ?? "/", `http://localhost`);
  const token = reqUrl.searchParams.get("token") || "";

  if (TOKEN && token !== TOKEN) {
    ws.close(4403, "Unauthorized");
    console.log(`[AUTH] Reddedilen bağlantı: ${req.socket.remoteAddress}`);
    return;
  }

  /* ── Origin kontrolü ── */
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGIN !== "*" && origin && origin !== ALLOWED_ORIGIN) {
    ws.close(4403, "Origin not allowed");
    return;
  }

  console.log(`[CONNECT] ${req.socket.remoteAddress} bağlandı`);

  /* ── PTY spawn ── */
  let cols = 80, rows = 24;
  const proc = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: WORK_DIR,
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

  /* ── İstemciden gelen mesajlar ── */
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
      /* ham string geldiyse doğrudan yaz */
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
  console.log(`\n✅ craft.ai Terminal Sunucusu çalışıyor`);
  console.log(`   Port  : ${PORT}`);
  console.log(`   Shell : ${SHELL}`);
  console.log(`   Auth  : ${TOKEN ? "✓ Token aktif" : "⚠ Token YOK"}`);
  console.log(`\n   Craft.AI Ayarları → Terminal Sunucusu:`);
  console.log(`   wss://<sunucu-ip>:${PORT}${TOKEN ? `?token=${TOKEN}` : ""}\n`);
});
