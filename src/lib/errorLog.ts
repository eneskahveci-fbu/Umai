/* Hata-sıfır programı (Faz 4): istemci tarafı hafif hata günlüğü.
   window.onerror + unhandledrejection yakalanır, son 20 kayıt sessionStorage'da
   tutulur (oturumluk; kişisel veri/telemetri GÖNDERİLMEZ — yalnız cihazda).
   Ayarlar → Gelişmiş'teki "Son hatalar" panelciği okur. */

export interface ClientError {
  ts: number;
  message: string;
  source?: string;
}

const KEY = "craftai_errlog";
const MAX = 20;

export function readErrors(): ClientError[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]") as ClientError[]; }
  catch { return []; }
}

export function clearErrors(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* yok */ }
}

export function logClientError(message: string, source?: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = readErrors();
    /* Ardışık aynı mesajı şişirme. */
    if (list[0]?.message === message) return;
    list.unshift({ ts: Date.now(), message: message.slice(0, 500), source });
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* günlük asla uygulamayı bozamaz */ }
}

let installed = false;
/** Global yakalayıcıları bir kez kurar (layout'taki NativeInit benzeri erken nokta). */
export function installErrorLog(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    logClientError(e.message || String(e.error ?? "bilinmeyen hata"), e.filename ? `${e.filename}:${e.lineno}` : "window");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    logClientError(r instanceof Error ? `${r.name}: ${r.message}` : String(r).slice(0, 300), "promise");
  });
}
