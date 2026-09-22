/* Terminal çekirdeği — SAF yardımcılar (DOM/xterm yok → vitest'te test edilir).
   RealTerminal'in iki taşıyıcısı (uzak WebSocket PTY + WebContainer) ve AI
   run-command köprüsü bu tek kaynağı paylaşır; eskiden her biri kendi kopyasını
   taşıyordu. */

/** Terminal arka planı — uygulama temasından bağımsız hep koyu (okunabilirlik). */
export function terminalBackground(theme: "dark" | "light"): string {
  return theme === "light" ? "#23271f" : "#12140f";
}

export function xtermTheme(theme: "dark" | "light") {
  return {
    background: terminalBackground(theme),
    foreground: "#e6e3d8",
    cursor: "#5c9478",
    selectionBackground: "#5c947840",
    black: "#1c1917",
    brightBlack: "#4a4540",
  };
}

export const TERMINAL_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const FONT_MIN = 9;
export const FONT_MAX = 24;
export const FONT_DEFAULT = 13;
export const HEIGHT_MIN = 120;
export const HEIGHT_DEFAULT = 256;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Kalıcı terminal yüksekliğini güvenle sınırla (bozuk/eksik değer → varsayılan). */
export function clampHeight(raw: unknown, viewport: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return HEIGHT_DEFAULT;
  return Math.round(clamp(n, HEIGHT_MIN, Math.max(HEIGHT_MIN, viewport * 0.85)));
}

export function clampFont(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return FONT_DEFAULT;
  return Math.round(clamp(n, FONT_MIN, FONT_MAX));
}

/** Kullanıcının yapıştırdığı adresi ws(s)://'e normalize eder.
    - http(s):// yanlışlıkla yapıştırılmışsa ws(s)://'e çevrilir.
    - HTTPS sayfada ws:// tarayıcıda SESSİZCE engellenir (mixed content) →
      wss://'e yükseltilir; "Sunucuya bağlanılamadı"nın en yaygın gizli sebebi.
    - Şema hâlâ ws/wss değilse eyleme dönük hata döner. */
export function normalizeWsUrl(raw: string, pageIsHttps: boolean): { url: string } | { error: string } {
  let url = raw.trim();
  if (/^https:\/\//i.test(url)) url = url.replace(/^https:/i, "wss:");
  else if (/^http:\/\//i.test(url)) url = url.replace(/^http:/i, "ws:");
  if (pageIsHttps && /^ws:\/\//i.test(url)) url = url.replace(/^ws:/i, "wss:");
  if (!/^wss?:\/\/[^/\s]+/i.test(url)) {
    return { error: "Geçersiz terminal adresi. wss://sunucu/?token=… biçiminde olmalı (Oracle kurulumunun verdiği adresi yapıştır)." };
  }
  return { url };
}

/** Araç çubuğu etiketi için yalnız host (token'ı ASLA göstermez). */
export function hostLabel(raw: string): string {
  try { return new URL(raw.trim()).hostname || "ws"; } catch { return "ws"; }
}

/** CSI + OSC ANSI dizilerini ve \r'yi temizler (AI'ya giden düz metin). */
export function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, "")
    .replace(/\r/g, "");
}

export const OUTPUT_BUFFER_MAX = 200_000;

/** Sona ekler, en fazla `max` karakterlik kuyruğu tutar. */
export function appendCapped(buf: string, chunk: string, max = OUTPUT_BUFFER_MAX): string {
  const next = buf + chunk;
  return next.length > max ? next.slice(-max) : next;
}

/* ── Sentinel: komut bitişini sabit timeout yerine işaretle algıla ──
   echo START → komut → echo DONE:<exit>. İşaretler gerçek çıktıyı sarar;
   PTY girişi yankıladığında DONE ":%s" olarak görünür, "(\d+)" ile eşleşmez. */
export interface Sentinel { start: string; done: string; line: string }

export function makeSentinel(cmd: string, id: string): Sentinel {
  const start = `__CRAFT_S_${id}__`;
  const done = `__CRAFT_D_${id}__`;
  return { start, done, line: `printf '${start}\\n'; ${cmd}; printf '${done}:%s\\n' "$?"\n` };
}

export const RESULT_MAX = 6000;

/** Çıktı diliminden sonucu çıkarır. Bitmediyse ve zaman aşımı yoksa null. */
export function extractSentinelResult(
  slice: string,
  s: Pick<Sentinel, "start" | "done">,
  timedOut: boolean,
): { output: string; code: string } | null {
  const m = slice.match(new RegExp(`${s.done}:(\\d+)`));
  if (!m && !timedOut) return null;
  const end = m ? m.index : undefined;
  const sIdx = slice.lastIndexOf(s.start, end);
  const raw = sIdx >= 0 ? slice.slice(sIdx + s.start.length, end) : slice;
  return { output: stripAnsi(raw).trim(), code: m ? m[1] : "timeout" };
}

export function formatResult(r: { output: string; code: string }): string {
  return `${r.output || "(çıktı yok)"}\n[exit: ${r.code}]`.slice(-RESULT_MAX);
}
