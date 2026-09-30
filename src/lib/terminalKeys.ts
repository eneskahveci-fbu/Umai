/* Terminal yardımcıları — RealTerminal.tsx'in SAF (DOM'suz, test edilebilir)
   mantığı. Mobil tuş şeridi (Esc/Tab/Ctrl/oklar), hızlı komutlar, yeniden
   bağlanma aralığı ve köprü sağlık adresi burada; bileşen yalnız bunları
   çağırır. Vitest `environment: node` olduğu için DOM'a dokunan hiçbir şey
   bu dosyaya girmemeli. */

/** Mobil tuş şeridinin gönderdiği ham diziler (xterm/VT100 normal kip). */
export const KEY_SEQ = {
  esc: "\x1b",
  tab: "\t",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  home: "\x1b[H",
  end: "\x1b[F",
  ctrlC: "\x03",
  ctrlD: "\x04",
} as const;

export type KeyName = keyof typeof KEY_SEQ;

/** Yapışkan Ctrl: bir sonraki TEK karakteri kontrol koduna çevirir
 *  (a→0x01 … z→0x1a, [→ESC, ?→DEL…). Çevrilemeyen girdi (çok karakterli
 *  yapıştırma, rakam vb.) olduğu gibi döner — kullanıcı yanlışlıkla Ctrl'e
 *  basıp sonra bir metin yapıştırırsa metin bozulmaz. */
export function applyCtrl(data: string): string {
  if (data.length !== 1) return data;
  const c = data;
  if (c >= "a" && c <= "z") return String.fromCharCode(c.charCodeAt(0) - 96);
  if (c >= "A" && c <= "Z") return String.fromCharCode(c.charCodeAt(0) - 64);
  switch (c) {
    case "@": case " ": return "\x00";
    case "[": return "\x1b";
    case "\\": return "\x1c";
    case "]": return "\x1d";
    case "^": return "\x1e";
    case "_": case "-": return "\x1f";
    case "?": return "\x7f";
    default: return data;
  }
}

/** Kopan bağlantı için bekleme süresi: 1s, 2s, 4s, 8s, sonra 15s'de sabit. */
export function reconnectDelay(attempt: number): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(1000 * 2 ** n, 15_000);
}

/** Bağlantı kopunca en fazla kaç kez otomatik denenir (~2,5 dk). */
export const MAX_RECONNECT_ATTEMPTS = 12;

/** wss://alan/?token=… → https://alan/health (köprünün tokensız sağlık ucu).
 *  ws:// → http://. Geçersiz adreste null. */
export function healthUrlFromWs(wsUrl: string): string | null {
  const raw = wsUrl.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const secure = u.protocol === "wss:" || u.protocol === "https:";
    const plain = u.protocol === "ws:" || u.protocol === "http:";
    if (!secure && !plain) return null;
    return `${secure ? "https:" : "http:"}//${u.host}/health`;
  } catch {
    return null;
  }
}

/** Köprünün sürümü, PATH/renk düzeltmesini içeren sürümden eski mi? */
export const MIN_BRIDGE_VERSION = "2.1.0";

export function isBridgeOutdated(version: unknown, min: string = MIN_BRIDGE_VERSION): boolean {
  if (typeof version !== "string" || !/^\d+(\.\d+)*$/.test(version.trim())) return true;
  const a = version.trim().split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** Köprüyü sudo GEREKMEDEN güncelleyen tek satır. Dosyalar `craftbridge`
 *  kullanıcısına ait olduğu için terminalin kendisi yazabilir; eski süreci
 *  öldürünce systemd (Restart=always) 3 sn içinde yeni kodla kaldırır.
 *  `node --check` bozuk indirmeyi canlı dosyanın üstüne yazmadan yakalar. */
export const BRIDGE_UPDATE_COMMAND =
  "curl -fsSL https://gitlab.com/eneskahveci.bs/craft-coder/-/raw/main/scripts/terminal-bridge/bridge.mjs -o /opt/craft-bridge/bridge.mjs.new" +
  " && node --check /opt/craft-bridge/bridge.mjs.new" +
  " && mv /opt/craft-bridge/bridge.mjs.new /opt/craft-bridge/bridge.mjs" +
  " && pkill -u \"$(id -u)\" -f 'node /opt/craft-bridge/bridge.mjs'";

export const DEFAULT_QUICK_COMMANDS: readonly string[] = ["opencode", "clear", "ls -la", "git status"];

export const MAX_QUICK_COMMANDS = 12;

/** Ayarlardaki çok satırlı metni (her satır bir komut) listeye çevirir:
 *  boşlar atılır, tekrarlar tekilleşir, en fazla MAX_QUICK_COMMANDS. */
export function parseQuickCommands(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cmd = line.trim();
    if (!cmd || out.includes(cmd)) continue;
    out.push(cmd);
    if (out.length >= MAX_QUICK_COMMANDS) break;
  }
  return out;
}

/** Çip üzerinde gösterilecek kısa etiket (uzun komutları kırpar). */
export function quickCommandLabel(cmd: string, max = 18): string {
  const c = cmd.trim();
  return c.length > max ? c.slice(0, max - 1) + "…" : c;
}

export const TERMINAL_FONT_MIN = 9;
export const TERMINAL_FONT_MAX = 22;
export const TERMINAL_FONT_DEFAULT = 13;

export function clampFontSize(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : TERMINAL_FONT_DEFAULT;
  return Math.min(TERMINAL_FONT_MAX, Math.max(TERMINAL_FONT_MIN, v));
}
