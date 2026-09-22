/* Uzak WebSocket PTY taşıyıcısı (Oracle köprüsü / terminal-server).
   Protokol: istemci {type:"input",data} | {type:"resize",cols,rows} yollar,
   sunucu {type:"output",data} döner. */
import { useStore } from "@/lib/store";
import { OUTPUT_BUFFER_MAX, appendCapped, normalizeWsUrl } from "./core";
import { attachRunBridge } from "./runBridge";
import type { TerminalView } from "./view";

const CONNECT_TIMEOUT_MS = 12_000;

export interface TransportCallbacks {
  onReady: () => void;
  onError: (msg: string) => void;
  /** Kurulmuş bağlantı sonradan koptu (terminal içeriği korunur). */
  onClosed?: () => void;
}

export function connectWs(view: TerminalView, rawUrl: string, cb: TransportCallbacks): () => void {
  const { term } = view;
  const pageIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const norm = normalizeWsUrl(rawUrl, pageIsHttps);
  if ("error" in norm) { cb.onError(norm.error); return () => {}; }

  let ws: WebSocket;
  try {
    ws = new WebSocket(norm.url);
  } catch (e) {
    cb.onError(`Terminal adresi açılamadı: ${(e as Error).message}`);
    return () => {};
  }

  const send = (msg: object): boolean => {
    if (ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  };

  /* WS açılmazsa onerror bazen hiç ateşlemez (özellikle mobil Safari). */
  let opened = false;
  let disposed = false;
  let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    if (!opened && ws.readyState !== WebSocket.OPEN) {
      try { ws.close(); } catch { /* yoksay */ }
      cb.onError("Sunucu yanıt vermiyor (12s). Oracle sunucusu çalışıyor mu, TLS/port (443) açık mı ve adres+token doğru mu kontrol et.");
    }
  }, CONNECT_TIMEOUT_MS);
  const clearConnectTimer = () => { if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; } };

  let outputBuffer = "";

  ws.onopen = () => {
    opened = true;
    clearConnectTimer();
    send({ type: "resize", cols: term.cols, rows: term.rows });
    cb.onReady();
    /* Otomasyon: bağlanınca kurulum komutunu bir kez çalıştır (SessionStart). */
    const setup = useStore.getState().config.terminalSetupCommand?.trim();
    if (setup) setTimeout(() => { send({ type: "input", data: setup + "\n" }); }, 300);
  };
  ws.onerror = () => {
    clearConnectTimer();
    if (opened) return; // kopma onclose'ta ele alınır
    cb.onError(
      pageIsHttps
        ? "Sunucuya bağlanılamadı. HTTPS sitede yalnızca wss:// (TLS'li) çalışır — Oracle sunucusunun çalıştığını ve sertifikasının geçerli olduğunu doğrula; adres+token'ı kontrol et."
        : "Sunucuya bağlanılamadı. URL'i ve token'ı kontrol et (sunucu çalışıyor ve port açık olmalı).",
    );
  };
  ws.onclose = (ev) => {
    clearConnectTimer();
    if (disposed) return;
    if (ev.code === 4403) { cb.onError("Erişim reddedildi — token geçersiz."); return; }
    if (!opened) {
      cb.onError("Bağlantı kurulamadan kapandı. Sunucu adresi/port erişilebilir mi ve token doğru mu kontrol et.");
      return;
    }
    term.writeln("\r\n\x1b[33m[Bağlantı kapandı — yeniden bağlanmak için ⟳]\x1b[0m");
    cb.onClosed?.();
  };
  ws.onmessage = (ev) => {
    let data: string | undefined;
    try {
      const msg = JSON.parse(ev.data as string) as { type: string; data?: string };
      if (msg.type === "output") data = msg.data;
    } catch { data = ev.data as string; }
    if (!data) return;
    term.write(data);
    outputBuffer = appendCapped(outputBuffer, data, OUTPUT_BUFFER_MAX);
  };

  const inputSub = term.onData((d) => { send({ type: "input", data: d }); });
  view.onResize((cols, rows) => { send({ type: "resize", cols, rows }); });
  const detachBridge = attachRunBridge({
    send: (data) => send({ type: "input", data }),
    buffer: () => outputBuffer,
  });

  return () => {
    disposed = true;
    clearConnectTimer();
    detachBridge();
    inputSub.dispose();
    try { ws.close(); } catch { /* yoksay */ }
  };
}
