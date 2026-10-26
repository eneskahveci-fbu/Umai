"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Cloud, ClipboardPaste, Copy, DownloadCloud, ExternalLink, FolderOpen, Loader2, Maximize2, Minimize2, Power, RefreshCw, Settings as SettingsIcon, X } from "lucide-react";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import { getUnsupportedReason, getWebContainer, isSupported, mountDefaults, mountFiles, needsApiKey } from "@/lib/webcontainer";
import { fetchAllFiles } from "@/lib/github";
import { fetchAllGitLabFiles, resolveRepoProvider } from "@/lib/gitlab";
import type { TreeNode } from "@/lib/types";
import {
  dirHandleToTree,
  getMountedHandle,
  getMountedName,
  isLocalFsSupported,
  pickLocalDirectory,
  setMounted,
} from "@/lib/localfs";
import { useStore } from "@/lib/store";
import {
  applyCtrl,
  BRIDGE_UPDATE_COMMAND,
  clampFontSize,
  DEFAULT_QUICK_COMMANDS,
  healthUrlFromWs,
  isBridgeOutdated,
  KEY_SEQ,
  MAX_RECONNECT_ATTEMPTS,
  quickCommandLabel,
  reconnectDelay,
  TERMINAL_FONT_MAX,
  TERMINAL_FONT_MIN,
} from "@/lib/terminalKeys";
import { isAdminEmail } from "@/lib/admin";
import { isLoopbackWsUrl, resolveTerminalWsUrl } from "@/lib/terminalAccess";

/* Toolbar'daki Kopyala/Yapıştır düğmelerinin çağırdığı, terminale bağlı arayüz.
   Klavye kısayolu (Ctrl/Cmd+C/V) MOBİLDE anlamsız — fiziksel klavye/Ctrl tuşu
   yok. Bu yüzden aynı işlevi dokunmatik düğmelerle de sunuyoruz (bkz. aşağı,
   toolbar). copySelection() seçili metin yoksa false döner (çağıran "önce
   metin seç" gibi bir uyarı gösterebilir). */
export interface TermApi {
  copySelection: () => Promise<boolean>;
  paste: (text: string) => void;
  /** Ham diziyi (tuş/komut) doğrudan kabuğa yazar — Ctrl kilidinden GEÇMEZ. */
  send: (data: string) => void;
  focus: () => void;
  setFontSize: (px: number) => void;
}

/** boot* fonksiyonlarının ortak seçenekleri. */
interface BootCommon {
  appTheme: "dark" | "light";
  fontSize: number;
  onReady: () => void;
  onApi: (api: TermApi | null) => void;
  /** Klavyeden gelen her girdi buradan geçer (mobil yapışkan Ctrl). */
  transformInput: (data: string) => string;
}

/* Kopyala/yapıştır: xterm'in varsayılanı seçili metin olsa bile Ctrl/Cmd+C'yi
   HER ZAMAN SIGINT byte'ı (0x03) olarak kabuğa gönderiyordu — kopyalama hiç
   çalışmıyordu, Ctrl+C her zaman çalışan komutu kesiyordu. Burada: seçili
   metin varken Ctrl/Cmd+C panoya kopyalar (SIGINT GÖNDERMEZ — `return false`
   xterm'e olayı yutturur); seçili metin YOKKEN her zamanki gibi SIGINT gider
   (`return true`). Ctrl/Cmd+V panodan `sendInput` ile terminale yazar. Ayrıca
   fare ile seçim bırakılınca (mouseup) otomatik kopyalar — çoğu masaüstü
   terminalinin (iTerm/gnome-terminal vb.) alışılmış davranışı. Bunlar masaüstü
   (klavye/fare) içindir; `api` (dönüş değeri) mobil dokunmatik düğmeler için. */
function attachClipboardHandlers(term: XtermTerminal, sendInput: (data: string) => void): { api: Pick<TermApi, "copySelection" | "paste">; cleanup: () => void } {
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== "keydown" || !(ev.ctrlKey || ev.metaKey)) return true;
    const key = ev.key.toLowerCase();
    if (key === "c" && term.hasSelection()) {
      void navigator.clipboard?.writeText(term.getSelection()).catch(() => {});
      return false;
    }
    if (key === "v") {
      navigator.clipboard?.readText().then((text) => { if (text) sendInput(text); }).catch(() => {});
      return false;
    }
    return true;
  });
  const onMouseUp = () => {
    if (term.hasSelection()) void navigator.clipboard?.writeText(term.getSelection()).catch(() => {});
  };
  term.element?.addEventListener("mouseup", onMouseUp);
  const api: Pick<TermApi, "copySelection" | "paste"> = {
    copySelection: async () => {
      if (!term.hasSelection()) return false;
      await navigator.clipboard?.writeText(term.getSelection());
      return true;
    },
    paste: sendInput,
  };
  return { api, cleanup: () => { term.element?.removeEventListener("mouseup", onMouseUp); } };
}

function codespaceUrl(owner: string, repo: string, branch?: string): string {
  const u = new URL("https://github.com/codespaces/new");
  u.searchParams.set("repo", `${owner}/${repo}`);
  if (branch) u.searchParams.set("ref", branch);
  return u.toString();
}

type Status = "idle" | "booting" | "ready" | "reconnecting" | "error" | "needs-key";

/** Ortak xterm teması — 16 rengin tamamı tanımlı ki TUI uygulamaları
 *  (opencode, htop, vim) varsayılan tarayıcı renklerine düşüp soluk görünmesin. */
function termTheme(appTheme: "dark" | "light") {
  const isLight = appTheme === "light";
  return {
    background: isLight ? "#23271f" : "#12140f",
    foreground: "#e6e3d8", cursor: "#5c9478", cursorAccent: "#12140f",
    selectionBackground: "#5c947840",
    black: "#1c1917", red: "#e06c63", green: "#7fb487", yellow: "#d9b35b",
    blue: "#6f9fd8", magenta: "#b98ad6", cyan: "#62b3b0", white: "#d8d4c8",
    brightBlack: "#5a554e", brightRed: "#f08a82", brightGreen: "#9fd1a6", brightYellow: "#ecc97a",
    brightBlue: "#92bbef", brightMagenta: "#d0a9e8", brightCyan: "#86cfcc", brightWhite: "#f4f1e8",
  };
}

/* ── WebSocket PTY mode ─────────────────────────────────────────────
   Connects to a remote terminal-server (ws/wss URL).
   Protocol: client sends JSON {type:"input",data:"..."} | {type:"resize",cols,rows}
             server sends JSON {type:"output",data:"..."}

   Dayanıklılık (Eyl 2026):
   - Bağlantı BİR KEZ kurulduktan sonra koparsa (iPhone Safari'yi arka plana
     alınca WS'i öldürür, köprü yeniden başlar, ağ değişir) terminal kapanmaz:
     üstel beklemeyle (1→2→4→8→15 sn) kendisi yeniden bağlanır. Sunucudaki
     kabuk YENİ bir oturumdur (PTY bağlantıya bağlı) — bunu satırda söyleriz.
   - Sayfa tekrar görünür olunca / ağ geri gelince beklemeden hemen dener.
   - İlk bağlantı hiç kurulamazsa /health'e bakıp NEDENİ ayırır: köprü
     ayakta ama WS reddedildi → neredeyse her zaman yanlış token (bu durumda
     tekrar denemek anlamsız); köprüye hiç ulaşılamıyor → sunucu kapalı /
     yeniden başlıyor, 15 sn'de bir kendisi tekrar dener. */
interface WsBootOpts extends BootCommon {
  wsUrl: string;
  onError: (msg: string) => void;
  onReconnecting: (attempt: number) => void;
  onBridgeInfo: (info: { version: string | null; outdated: boolean }) => void;
}

async function bootWsTerminal(containerEl: HTMLDivElement, o: WsBootOpts): Promise<() => void> {
  const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-web-links"),
  ]);
  await import("@xterm/xterm/css/xterm.css");

  const term = new Terminal({
    convertEol: true, cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: o.fontSize,
    scrollback: 5000,
    theme: termTheme(o.appTheme),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  /* `npm run dev` → http://localhost:3000 gibi adresler tıklanabilir. */
  term.loadAddon(new WebLinksAddon());
  term.open(containerEl);
  fit.fit();

  /* URL'i normalize et + yaygın hataları yakala:
     - http(s):// yanlışlıkla yapıştırılmışsa ws(s)://'e çevir (Oracle "Yerel Mod"
       https adresi de buraya konabilir → wss'e döner).
     - HTTPS bir sayfada (vercel.app) güvensiz ws:// tarayıcı tarafından SESSİZCE
       engellenir (mixed content) → otomatik wss'e yükselt; bu, "Sunucuya
       bağlanılamadı" hatasının en yaygın gizli sebebidir.
     - Şema hâlâ ws/wss değilse net, eyleme dönük hata ver. */
  let url = o.wsUrl.trim();
  if (/^https:\/\//i.test(url)) url = url.replace(/^https:/i, "wss:");
  else if (/^http:\/\//i.test(url)) url = url.replace(/^http:/i, "ws:");
  const pageIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  if (pageIsHttps && /^ws:\/\//i.test(url)) url = url.replace(/^ws:/i, "wss:");
  if (!/^wss?:\/\//i.test(url)) {
    o.onError("Geçersiz terminal adresi. ws://sunucu:port/?token=… biçiminde olmalı.");
    return () => { term.dispose(); };
  }
  const healthUrl = healthUrlFromWs(url);

  let ws: WebSocket | null = null;
  let disposed = false;
  let everOpened = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let outputBuffer = "";
  let versionChecked = false;

  const clearTimers = () => {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
  };
  const isOpen = () => !!ws && ws.readyState === WebSocket.OPEN;
  const sendRaw = (d: string) => { if (isOpen()) ws!.send(JSON.stringify({ type: "input", data: d })); };
  const sendResize = () => { if (isOpen()) ws!.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); };

  /** /health: kimlik doğrulamasız, CORS açık. null = ulaşılamadı. */
  const fetchHealth = async (): Promise<{ ok?: boolean; version?: string } | null> => {
    if (!healthUrl) return null;
    try {
      const r = await fetch(healthUrl, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const d = (await r.json().catch(() => null)) as { ok?: boolean; version?: string } | null;
      return d?.ok ? d : null;
    } catch {
      return null;
    }
  };

  const handleMessage = (ev: MessageEvent) => {
    let chunk: string | null = null;
    if (typeof ev.data === "string") {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; data?: string };
        if (msg?.type === "output" && typeof msg.data === "string") chunk = msg.data;
      } catch { chunk = ev.data; }
    }
    if (!chunk) return;
    term.write(chunk);
    outputBuffer += chunk;
    if (outputBuffer.length > 200_000) outputBuffer = outputBuffer.slice(-200_000);
  };

  const scheduleRetry = (delay: number) => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
  };

  const handleFailure = async (sock: WebSocket, code: number | null) => {
    if (disposed || ws !== sock) return;
    if (code === 4403) { o.onError("Erişim reddedildi — token geçersiz."); return; }

    if (everOpened) {
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        term.writeln("\r\n\x1b[31m[Bağlantı geri gelmedi — yeniden başlat düğmesiyle tekrar dene]\x1b[0m");
        o.onError("Bağlantı koptu ve birkaç denemede geri gelmedi. Terminal sunucusu çalışıyor mu kontrol et, sonra “Tekrar dene”ye bas.");
        return;
      }
      const delay = reconnectDelay(attempt);
      attempt++;
      term.writeln(`\r\n\x1b[33m[Bağlantı koptu — ${Math.round(delay / 1000)} sn içinde yeniden bağlanılıyor (${attempt}/${MAX_RECONNECT_ATTEMPTS})]\x1b[0m`);
      o.onReconnecting(attempt);
      scheduleRetry(delay);
      return;
    }

    /* İlk bağlantı hiç kurulamadı → nedenini ayır. */
    const health = await fetchHealth();
    if (disposed || ws !== sock) return;
    if (health) {
      o.onError("Terminal sunucusu çalışıyor ama bağlantıyı reddetti — adres doğru, büyük ihtimalle token yanlış. Ayarlar → Terminal & Sunucu'daki adresi kontrol et.");
      return;
    }
    o.onError(
      pageIsHttps
        ? "Terminal sunucusuna ulaşılamıyor — kapalı ya da yeniden başlıyor olabilir. 15 sn'de bir kendim tekrar deniyorum."
        : "Terminal sunucusuna ulaşılamıyor — adres/port açık mı ve sunucu çalışıyor mu kontrol et. 15 sn'de bir kendim tekrar deniyorum.",
    );
    scheduleRetry(15_000);
  };

  const checkVersion = async () => {
    if (versionChecked) return;
    versionChecked = true;
    const health = await fetchHealth();
    if (disposed || !health) return;
    const version = typeof health.version === "string" ? health.version : null;
    o.onBridgeInfo({ version, outdated: isBridgeOutdated(version) });
  };

  function connect() {
    if (disposed) return;
    clearTimers();
    let sock: WebSocket;
    try {
      sock = new WebSocket(url);
    } catch (e) {
      o.onError(`Terminal adresi açılamadı: ${(e as Error).message}`);
      return;
    }
    ws = sock;
    let opened = false;
    let handled = false;
    const fail = (code: number | null) => {
      if (handled) return;
      handled = true;
      void handleFailure(sock, code);
    };
    /* WS açılmazsa onerror/onclose bazen hiç ateşlemez (özellikle mobil
       Safari) — 12 sn'de açılmazsa başarısız say. */
    connectTimer = setTimeout(() => {
      if (!opened) { try { sock.close(); } catch { /* yoksay */ } fail(null); }
    }, 12_000);
    sock.onopen = () => {
      opened = true;
      if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
      const wasReconnect = everOpened;
      everOpened = true;
      attempt = 0;
      fit.fit();
      sendResize();
      o.onReady();
      if (wasReconnect) {
        term.writeln("\x1b[32m[Yeniden bağlandı — yeni kabuk oturumu]\x1b[0m");
      } else {
        /* Otomasyon: bağlanınca kurulum komutunu bir kez çalıştır (SessionStart). */
        const setup = useStore.getState().config.terminalSetupCommand?.trim();
        if (setup) setTimeout(() => sendRaw(setup + "\n"), 300);
      }
      void checkVersion();
    };
    sock.onmessage = handleMessage;
    sock.onerror = () => { /* onclose her zaman ardından gelir; teşhis orada */ };
    sock.onclose = (ev) => {
      if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
      fail(ev.code);
    };
  }

  /* iPhone: Safari arka plandan dönünce ya da ağ geri gelince beklemeden dene. */
  const wake = () => {
    if (disposed || document.visibilityState !== "visible") return;
    if (!everOpened && !retryTimer) return; // token hatası vb. — kendiliğinden deneme yok
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    attempt = 0;
    connect();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);

  term.onData((d) => sendRaw(o.transformInput(d)));
  const { api: clip, cleanup: cleanupClipboard } = attachClipboardHandlers(term, sendRaw);
  o.onApi({
    ...clip,
    send: sendRaw,
    focus: () => term.focus(),
    setFontSize: (px) => { term.options.fontSize = px; fit.fit(); sendResize(); },
  });

  const resize = () => {
    fit.fit();
    sendResize();
  };
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize);
  ro.observe(containerEl);

  /* AI run-command bridge — komut bitişini SENTINEL marker ile algılar (sabit
     timeout yok), exit code'u yakalar ve ANSI'den temizlenmiş çıktı döndürür.
     Böylece build/install/test gibi uzun komutlar eksiksiz ve doğru raporlanır
     (Claude Code'un stdout+exit davranışına yakın). `ws` yeniden bağlanmada
     değiştiği için her zaman GÜNCEL soket üzerinden gider (sendRaw). */
  const handleRunCmd = (e: Event) => {
    const cmd = (e as CustomEvent<{ command: string }>).detail?.command;
    if (!cmd || !isOpen()) return;
    const id = Math.random().toString(36).slice(2, 8);
    const START = `__CRAFT_S_${id}__`;
    const DONE = `__CRAFT_D_${id}__`;
    const from = outputBuffer.length;
    /* echo START → komut → echo DONE:exitcode. Marker'lar gerçek çıktıyı sarar. */
    sendRaw(`printf '${START}\\n'; ${cmd}; printf '${DONE}:%s\\n' "$?"\n`);
    const startedAt = Date.now();
    const doneRe = new RegExp(`${DONE}:(\\d+)`);
    const poll = setInterval(() => {
      const slice = outputBuffer.slice(from);
      const m = slice.match(doneRe);
      const timedOut = Date.now() - startedAt > 120_000;
      if (!m && !timedOut) return;
      clearInterval(poll);
      const sIdx = slice.lastIndexOf(START, m ? m.index : undefined);
      let out = sIdx >= 0 ? slice.slice(sIdx + START.length, m ? m.index : undefined) : slice;
      out = out
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")   // CSI ANSI dizileri
        .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, "") // OSC dizileri
        .replace(/\r/g, "")
        .trim();
      const code = m ? m[1] : "timeout";
      const body = `${out || "(çıktı yok)"}\n[exit: ${code}]`.slice(-6000);
      window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: cmd, output: body } }));
    }, 300);
  };
  window.addEventListener("craftai:terminal-run", handleRunCmd);

  connect();

  return () => {
    disposed = true;
    clearTimers();
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", wake);
    window.removeEventListener("craftai:terminal-run", handleRunCmd);
    window.removeEventListener("resize", resize);
    ro.disconnect();
    cleanupClipboard();
    o.onApi(null);
    try { ws?.close(); } catch { /* yoksay */ }
    term.dispose();
  };
}

/* ── WebContainer mode (mevcut) ─────────────────────────────────── */
/* Repo ağacını düz blob listesine çevirir (mount için). */
function treeBlobs(node: TreeNode): { path: string; type: string }[] {
  const items: { path: string; type: string }[] = [];
  for (const f of node.files) items.push({ path: f.path, type: "blob" });
  for (const child of Object.values(node.dirs)) items.push(...treeBlobs(child));
  return items;
}

interface WcBootOpts extends BootCommon {
  apiKey: string;
  onError: (msg: string) => void;
  onNeedsKey: () => void;
  loadRepoFiles?: () => Promise<{ path: string; content: string }[]>;
}

async function bootWcTerminal(containerEl: HTMLDivElement, o: WcBootOpts): Promise<() => void> {
  const { apiKey, onReady, onError, onNeedsKey, onApi, loadRepoFiles } = o;
  if (!isSupported()) { onError(getUnsupportedReason() ?? "Tarayıcı desteklemiyor."); return () => {}; }
  if (needsApiKey() && !apiKey.trim()) { onNeedsKey(); return () => {}; }

  const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-web-links"),
  ]);
  await import("@xterm/xterm/css/xterm.css");

  const term = new Terminal({
    convertEol: true, cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: o.fontSize,
    scrollback: 5000,
    theme: termTheme(o.appTheme),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  /* `npm run dev` → http://localhost:3000 gibi adresler tıklanabilir. */
  term.loadAddon(new WebLinksAddon());
  term.open(containerEl);
  fit.fit();

  const wc = await getWebContainer(apiKey);
  const handle = getMountedHandle();
  if (handle) {
    const { tree, fileCount, truncated, skipped } = await dirHandleToTree(handle);
    await wc.mount(tree);
    term.writeln(`\x1b[1;32m✓ Mount: \x1b[36m${getMountedName()}\x1b[0m (${fileCount} dosya${truncated ? ", \x1b[33mkesildi\x1b[0m" : ""})`);
    if (skipped.length > 0) term.writeln(`\x1b[33m⚠ Atlandı (>5MB): ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ` ve ${skipped.length - 3} daha` : ""}\x1b[0m`);
  } else if (loadRepoFiles) {
    /* Yerel klasör yok ama bir repo bağlı → gerçek repoyu mount et. */
    term.writeln("\x1b[2mBağlı repo yükleniyor…\x1b[0m");
    try {
      const files = await loadRepoFiles();
      if (files.length) {
        await mountFiles(wc, files);
        term.writeln(`\x1b[1;32m✓ Repo mount edildi: \x1b[36m${files.length} dosya\x1b[0m — gerçek kod tabanı hazır`);
      } else {
        await mountDefaults(wc);
      }
    } catch {
      await mountDefaults(wc);
      term.writeln("\x1b[33m⚠ Repo yüklenemedi, boş sandbox açıldı.\x1b[0m");
    }
  } else {
    await mountDefaults(wc);
  }
  term.writeln("\x1b[1;35m▲ UMAI sandbox\x1b[0m — Node.js + busybox-shell hazır");
  term.writeln("\x1b[2mDeneyin: \x1b[36mnpm install\x1b[2m, \x1b[36mnpm run dev\x1b[2m, \x1b[36mnpm test\x1b[2m, \x1b[36mls\x1b[0m\n");

  const proc = await wc.spawn("jsh", { terminal: { cols: term.cols, rows: term.rows } });
  const writer = proc.input.getWriter();
  const sendInput = (d: string) => { void writer.write(d); };
  term.onData((d) => sendInput(o.transformInput(d)));
  const { api: clip, cleanup: cleanupClipboard } = attachClipboardHandlers(term, sendInput);
  const resizeProc = () => { try { proc.resize({ cols: term.cols, rows: term.rows }); } catch { /* not ready */ } };
  onApi({
    ...clip,
    send: sendInput,
    focus: () => term.focus(),
    setFontSize: (px) => { term.options.fontSize = px; fit.fit(); resizeProc(); },
  });

  let outputBuffer = "";
  proc.output.pipeTo(new WritableStream({
    write: (chunk) => {
      term.write(chunk);
      outputBuffer += chunk;
      if (outputBuffer.length > 200_000) outputBuffer = outputBuffer.slice(-200_000);
    },
  })).catch(() => {});

  /* SENTINEL marker ile komut bitişi + exit code (WS modundaki ile aynı). */
  const handleRunCmd = (e: Event) => {
    const cmd = (e as CustomEvent<{ command: string }>).detail?.command;
    if (!cmd) return;
    const id = Math.random().toString(36).slice(2, 8);
    const START = `__CRAFT_S_${id}__`;
    const DONE = `__CRAFT_D_${id}__`;
    const from = outputBuffer.length;
    writer.write(`printf '${START}\\n'; ${cmd}; printf '${DONE}:%s\\n' "$?"\n`);
    const startedAt = Date.now();
    const doneRe = new RegExp(`${DONE}:(\\d+)`);
    const poll = setInterval(() => {
      const slice = outputBuffer.slice(from);
      const m = slice.match(doneRe);
      const timedOut = Date.now() - startedAt > 120_000;
      if (!m && !timedOut) return;
      clearInterval(poll);
      const sIdx = slice.lastIndexOf(START, m ? m.index : undefined);
      let out = sIdx >= 0 ? slice.slice(sIdx + START.length, m ? m.index : undefined) : slice;
      out = out
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
        .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, "")
        .replace(/\r/g, "")
        .trim();
      const code = m ? m[1] : "timeout";
      const body = `${out || "(çıktı yok)"}\n[exit: ${code}]`.slice(-6000);
      window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: cmd, output: body } }));
    }, 300);
  };
  window.addEventListener("craftai:terminal-run", handleRunCmd);

  const resize = () => {
    fit.fit();
    resizeProc();
  };
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize);
  ro.observe(containerEl);
  onReady();

  return () => {
    window.removeEventListener("craftai:terminal-run", handleRunCmd);
    window.removeEventListener("resize", resize);
    ro.disconnect();
    cleanupClipboard();
    onApi(null);
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { proc.kill(); } catch { /* ignore */ }
    term.dispose();
  };
}

/* ── Component ─────────────────────────────────────────────────────── */

export function RealTerminal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [mountedFolder, setMountedFolder] = useState<string | null>(getMountedName());
  const [mounting, setMounting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  /* Dokunmatik Kopyala/Yapıştır düğmeleri için — boot* fonksiyonları hazır
     olunca doldurur (bkz. onApi), terminal yeniden başlayınca/kapanınca null. */
  const [termApi, setTermApi] = useState<TermApi | null>(null);
  const apiKey = useStore((s) => s.config.webcontainerApiKey);
  /* Terminal IDE mantığında KİŞİNİN KENDİ bilgisayarında çalışır. Admin
     ayarlarda uzak (Oracle/VPS) adres tanımlayabilir; admin dışı kullanıcıda
     uzak adres yok sayılır → localhost. Bkz. lib/terminalAccess.ts. */
  const configuredWsUrl = useStore((s) => s.config.terminalWsUrl ?? "");
  const isAdmin = isAdminEmail(useStore((s) => s.userEmail));
  const wsUrl = resolveTerminalWsUrl(configuredWsUrl, isAdmin);
  const localTerminal = isLoopbackWsUrl(wsUrl);
  const appTheme = useStore((s) => s.config.theme);
  const appThemeRef = useRef(appTheme);
  useEffect(() => { appThemeRef.current = appTheme; }, [appTheme]);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const addToast = useStore((s) => s.addToast);
  const repo = useStore((s) => s.repo);
  const codespaceHref = repo ? codespaceUrl(repo.owner, repo.repo, repo.branch) : null;
  /* WebContainer yalnız AÇIK istekle: bağlantı hatasında "Tarayıcıda dene".
     Varsayılan yol her zaman gerçek terminal (kendi bilgisayar / admin uzak). */
  const [sandboxFallback, setSandboxFallback] = useState(false);
  const sandboxFallbackRef = useRef(false);
  const useWs = !sandboxFallback;
  /* Tam ekran: herkese açık (Eyl 2026 kullanıcı kararı — terminal artık admin'e
     özel değil, "Coder odaklı yön"; eskiden yalnız admin'di). */
  const [fullscreen, setFullscreen] = useState(false);

  /* Yazı boyutu + hızlı komutlar config'te kalıcı. `terminalQuickCommands`
     yoksa modül seviyesindeki SABİT varsayılan kullanılır (her render'da yeni
     dizi üretmemek için — bkz. CLAUDE.md "Maximum update depth" tuzağı). */
  const fontSize = clampFontSize(useStore((s) => s.config.terminalFontSize));
  const fontSizeRef = useRef(fontSize);
  const quickCommands = useStore((s) => s.config.terminalQuickCommands) ?? DEFAULT_QUICK_COMMANDS;
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [bridgeInfo, setBridgeInfo] = useState<{ version: string | null; outdated: boolean } | null>(null);

  /* Mobil tuş şeridi yalnız dokunmatik (kaba işaretçi) cihazlarda — masaüstünde
     gerçek klavye var. Bileşen ssr:false ile yüklendiği için window güvenli. */
  const [isTouch] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);
  /* Yapışkan Ctrl: bir kez bas → klavyeden gelen SONRAKİ karakter Ctrl+X olur.
     boot* içindeki onData kapanışı güncel değeri ref'ten okur. */
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const ctrlRef = useRef(false);
  const transformInput = (data: string) => {
    if (!ctrlRef.current) return data;
    ctrlRef.current = false;
    setCtrlArmed(false);
    return applyCtrl(data);
  };
  const toggleCtrl = () => {
    ctrlRef.current = !ctrlRef.current;
    setCtrlArmed(ctrlRef.current);
    termApi?.focus();
  };
  const pressKey = (seq: string) => {
    ctrlRef.current = false;
    setCtrlArmed(false);
    termApi?.send(seq);
    termApi?.focus();
  };
  const runQuick = (cmd: string) => {
    termApi?.send(cmd + "\r");
    termApi?.focus();
  };
  const changeFont = (delta: number) => {
    const next = clampFontSize(fontSize + delta);
    if (next === fontSize) return;
    const { config, saveConfig } = useStore.getState();
    saveConfig({ ...config, terminalFontSize: next });
  };
  useEffect(() => {
    fontSizeRef.current = fontSize;
    termApi?.setFontSize(fontSize);
  }, [fontSize, termApi]);

  const updateBridge = () => {
    if (!termApi) return;
    if (!window.confirm("Köprü en son sürüme güncellenecek. Bağlantı birkaç saniye kopup kendiliğinden geri gelir (açık komutlar kapanır). Devam?")) return;
    termApi.send(BRIDGE_UPDATE_COMMAND + "\r");
    setBridgeInfo(null);
  };

  useEffect(() => {
    const fn = () => setMountedFolder(getMountedName());
    window.addEventListener("localfs:changed", fn);
    return () => window.removeEventListener("localfs:changed", fn);
  }, []);

  /* Tam ekrandayken Escape ile çık — terminali KAPATMAZ, yalnız küçültür. */
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  /* Hazır olunca haber ver → CoderView run_command'ı tam o an gönderir (kayıp yok). */
  useEffect(() => {
    if (status === "ready") window.dispatchEvent(new Event("craftai:terminal-ready"));
  }, [status]);

  const boot = async () => {
    if (!containerRef.current) return;
    setStatus("booting");
    setErrMsg("");
    try {
      const common = {
        appTheme: appThemeRef.current,
        fontSize: fontSizeRef.current,
        onReady: () => { setStatus("ready"); setReconnectAttempt(0); },
        onApi: setTermApi,
        transformInput,
      };
      const onError = (msg: string) => { setStatus("error"); setErrMsg(msg); };
      const wsMode = !sandboxFallbackRef.current;
      const cleanup = wsMode
        ? await bootWsTerminal(containerRef.current, {
            ...common,
            wsUrl,
            onError,
            onReconnecting: (n) => { setStatus("reconnecting"); setReconnectAttempt(n); },
            onBridgeInfo: setBridgeInfo,
          })
        : await bootWcTerminal(containerRef.current, {
            ...common,
            apiKey,
            onError,
            onNeedsKey: () => setStatus("needs-key"),
            /* Bağlı repoyu WebContainer'a getir → gerçek kod tabanında çalış. */
            loadRepoFiles: async () => {
              const store = useStore.getState();
              const r = store.repo;
              if (!r || !store.tree) return [];
              const treeItems = treeBlobs(store.tree);
              const activeRepo = store.config.activeRepo || "";
              if (resolveRepoProvider(r, activeRepo) === "gitlab") {
                return await fetchAllGitLabFiles(r.owner, r.repo, r.branch, treeItems, await store.tokenForRepo(activeRepo, "gitlab"));
              }
              return await fetchAllFiles(r.owner, r.repo, r.branch, treeItems, await store.tokenForRepo(activeRepo, "github"));
            },
          });
      cleanupRef.current = cleanup;
    } catch (e) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  };

  useEffect(() => {
    /* boot() ilk await'ten önce senkron setStatus çağırır; effect gövdesinde
       doğrudan çağırmak yerine bir tık erteleyerek "cascading render" uyarısını
       önleriz (davranış aynı — terminal yine mount'ta başlar). */
    const id = setTimeout(() => { void boot(); }, 0);
    return () => { clearTimeout(id); cleanupRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    boot();
  };

  /* Yerel terminal sunucusu kurulumu — hata ekranında kopyalanabilir. */
  const LOCAL_TERMINAL_SETUP = [
    "git clone https://github.com/eneskahveci-fbu/Umai.git",
    "cd Umai/terminal-server && npm install",
    "TERMINAL_TOKEN=gizli_sifre node server.js",
  ].join("\n");
  const copyLocalSetup = async () => {
    try {
      await navigator.clipboard.writeText(LOCAL_TERMINAL_SETUP);
      addToast("Kurulum komutu kopyalandı", "success");
    } catch {
      addToast("Kopyalanamadı — metni elle seçebilirsin", "error");
    }
  };
  /* WebContainer'a düş: tarayıcı sandbox'ı, kullanıcının makinesine erişmez. */
  const useBrowserSandbox = () => {
    sandboxFallbackRef.current = true;
    setSandboxFallback(true);
    cleanupRef.current?.();
    cleanupRef.current = null;
    boot();
  };

  const mountFolder = async () => {
    if (!isLocalFsSupported()) {
      addToast("Tarayıcın yerel klasör seçimini desteklemiyor (Chrome/Edge gerekli)", "error");
      return;
    }
    setMounting(true);
    try {
      const picked = await pickLocalDirectory();
      if (!picked) return;
      setMounted(picked.handle, picked.name);
      addToast(`✓ ${picked.name} mount edildi — terminal yeniden başlatılıyor`, "success");
      restart();
    } catch (e) {
      addToast(`Hata: ${(e as Error).message}`, "error");
    } finally {
      setMounting(false);
    }
  };

  const unmountFolder = () => {
    setMounted(null, null);
    addToast("Klasör kaldırıldı — terminal yeniden başlatılıyor", "info");
    restart();
  };

  const modeLabel = !useWs
    ? "WebContainer"
    : localTerminal
      ? "Bu bilgisayar"
      : `Uzak (${(() => { try { return new URL(wsUrl).hostname; } catch { return "ws"; } })()})`;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex flex-col"
          : "h-72 shrink-0 border-t border-line/60 flex flex-col"
      }
      style={{ backgroundColor: appTheme === "light" ? "#23271f" : "#12140f" }}
    >
      {/* Terminal toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line/30 bg-black/20 shrink-0">
        <Power size={11} className={
          status === "ready" ? "text-green" :
          status === "booting" || status === "reconnecting" ? "text-yellow animate-pulse" :
          status === "error" ? "text-red" : "text-white/30"
        } />
        {/* Adres kısalabilir ama DURUM hiç kırpılmaz — mobilde "Uzak (89.168…"
            yüzünden "hazır/koptu" bilgisi görünmüyordu. */}
        <span className="text-[11px] font-mono text-white/50 truncate min-w-0 max-w-[110px]" title={modeLabel}>{modeLabel}</span>
        <span className={
          "text-[11px] font-mono shrink-0 " +
          (status === "reconnecting" ? "text-yellow" : status === "error" ? "text-red" : "text-white/50")
        }>
          {status === "ready" ? "hazır" :
            status === "booting" ? "bağlanıyor…" :
            status === "reconnecting" ? `yeniden bağlanıyor (${reconnectAttempt})…` :
            status === "error" ? "hata" :
            status === "needs-key" ? "key gerekli" : "boşta"}
        </span>
        {!useWs && mountedFolder && (
          <button
            onClick={unmountFolder}
            title="Klasörü kaldır"
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green/15 hover:bg-green/25 text-green/90 font-mono transition-colors"
          >
            <FolderOpen size={10} /> {mountedFolder} <X size={9} className="opacity-60" />
          </button>
        )}
        <div className="flex-1" />
        {codespaceHref && (
          <a
            href={codespaceHref}
            target="_blank"
            rel="noopener noreferrer"
            title={`GitHub Codespaces'te aç — ${repo!.owner}/${repo!.repo}`}
            className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors"
          >
            <Cloud size={11} />
          </a>
        )}
        {!useWs && (
          <button
            onClick={mountFolder}
            disabled={mounting}
            aria-label="Yerel klasör mount et"
            title={mountedFolder ? "Başka klasör seç" : "Yerel klasör mount et"}
            className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors disabled:opacity-30"
          >
            {mounting ? <Loader2 size={11} className="animate-spin" /> : <FolderOpen size={11} />}
          </button>
        )}
        <button onClick={() => setSettingsOpen(true)} title="Terminal ayarları" className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors">
          <SettingsIcon size={11} />
        </button>
        <button onClick={restart} title="Yeniden başlat" className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors">
          <RefreshCw size={11} />
        </button>
        {/* Dokunmatik Kopyala/Yapıştır — mobilde Ctrl/Cmd tuşu yok, klavye
            kısayolu işe yaramaz. Herkese açık (admin'e özel değil). */}
        <button
          onClick={async () => {
            const ok = await termApi?.copySelection();
            if (!ok) addToast("Önce kopyalanacak metni seç (basılı tut → sürükle)", "info");
          }}
          disabled={!termApi}
          title="Seçili metni kopyala"
          className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors disabled:opacity-30"
        >
          <Copy size={11} />
        </button>
        <button
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) termApi?.paste(text);
            } catch {
              addToast("Pano okunamadı — terminale basılı tutup 'Yapıştır' deneyebilirsin", "info");
            }
          }}
          disabled={!termApi}
          title="Panodan yapıştır"
          className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors disabled:opacity-30"
        >
          <ClipboardPaste size={11} />
        </button>
        <button
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Tam ekrandan çık (Esc)" : "Tam ekran"}
          className="text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors"
        >
          {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>
        <button onClick={onClose} title="Kapat" className="text-white/40 hover:text-white/80 p-1 rounded transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Status overlays */}
      {status === "needs-key" && (
        <div className="flex-1 grid place-items-center px-6">
          <div className="text-center max-w-md">
            <p className="text-xs font-semibold text-white/80 mb-1.5">WebContainer API key gerekli</p>
            <p className="text-[11px] text-white/40 leading-relaxed mb-3">
              Bu domain&apos;de terminal çalışmak için ücretsiz bir key istiyor.{" "}
              <a href="https://webcontainer.io/enterprise" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                webcontainer.io
              </a>
              {" "}üzerinden al → Ayarlar → Geliştirici.{" "}
              <strong className="text-white/60">Ya da kendi sunucunu bağla (Ayarlar → Terminal).</strong>
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors font-semibold">
                <SettingsIcon size={11} /> Ayarlar
              </button>
              {codespaceHref && (
                <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white/90 transition-colors font-semibold">
                  <Cloud size={11} /> Codespaces&apos;te aç
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 grid place-items-center px-6 py-4 overflow-y-auto">
          <div className="text-center max-w-lg">
            <p className="text-xs text-red mb-1.5">Terminal başlatılamadı</p>
            <p className="text-[11px] text-white/40 leading-relaxed mb-3">{errMsg}</p>

            {/* Yerel terminal: tarayıcı kullanıcının makinesine doğrudan erişemez —
                küçük sunucuyu kendi bilgisayarında başlatması gerekir. */}
            {useWs && localTerminal && (
              <div className="text-left bg-black/25 border border-white/10 rounded-lg p-3 mb-3">
                <p className="text-[11px] text-white/60 mb-1.5">
                  Terminal <strong className="text-white/85">senin bilgisayarında</strong> çalışır. Küçük sunucuyu bir kez başlat:
                </p>
                <pre className="text-[10.5px] leading-relaxed font-mono text-white/70 whitespace-pre-wrap break-all select-all">{LOCAL_TERMINAL_SETUP}</pre>
                <button
                  onClick={copyLocalSetup}
                  className="mt-2 inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded border border-white/15 hover:border-white/30 text-white/60 hover:text-white/85 transition-colors"
                >
                  <Copy size={10} /> Komutu kopyala
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {useWs ? (
                <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors font-semibold">
                  <SettingsIcon size={11} /> Ayarlar
                </button>
              ) : codespaceHref ? (
                <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors font-semibold">
                  <Cloud size={11} /> Codespaces&apos;te aç
                </a>
              ) : (
                <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors font-semibold">
                  <SettingsIcon size={11} /> Sunucu bağla
                </button>
              )}
              <button onClick={restart} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors">
                Tekrar dene
              </button>
              {useWs && (
                <button onClick={useBrowserSandbox} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors">
                  Tarayıcıda dene
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "booting" && (
        <div className="flex-1 grid place-items-center">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 size={13} className="animate-spin" />
            {useWs
              ? localTerminal
                ? "Kendi bilgisayarındaki terminal sunucusuna bağlanılıyor…"
                : "Uzak sunucuya bağlanılıyor…"
              : "WebContainer başlatılıyor (5-10 sn sürebilir)…"}
          </div>
        </div>
      )}

      {status === "idle" && (
        <div className="flex-1 grid place-items-center">
          <div className="text-center space-y-2">
            <p className="text-[11px] text-white/40">Terminal hazırlanıyor…</p>
            {codespaceHref && (
              <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors">
                <ExternalLink size={11} /> Codespaces ile aç
              </a>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        role="group"
        aria-label={`Terminal — ${modeLabel}`}
        className="flex-1 min-h-0 px-2 py-1"
      />

      {/* Tuş şeridi: mobilde eksik tuşlar (Esc/Tab/Ctrl/oklar) + herkese hızlı
          komutlar + yazı boyutu. Düğmeler pointerdown'da odağı ÇALMAZ (bkz.
          KeyBtn) → iPhone klavyesi açık kalır, yazmaya devam edilir. */}
      {termApi && (status === "ready" || status === "reconnecting") && (
        <div
          role="toolbar"
          aria-label="Terminal tuşları ve hızlı komutlar"
          className="flex items-center gap-1 px-2 py-1.5 border-t border-white/5 bg-black/20 overflow-x-auto no-scrollbar shrink-0"
        >
          {isTouch && (
            <>
              <KeyBtn label="Esc" title="Escape" onPress={() => pressKey(KEY_SEQ.esc)} />
              <KeyBtn label="Tab" title="Tab (otomatik tamamla)" onPress={() => pressKey(KEY_SEQ.tab)} />
              <KeyBtn
                label="Ctrl"
                title={ctrlArmed ? "Ctrl basılı — sıradaki harf Ctrl+harf olur" : "Ctrl: bas, sonra bir harf yaz (ör. Ctrl → c)"}
                active={ctrlArmed}
                onPress={toggleCtrl}
              />
              <KeyBtn label="^C" title="Ctrl+C — çalışan komutu durdur" onPress={() => pressKey(KEY_SEQ.ctrlC)} />
              <KeyBtn label={<ArrowUp size={12} />} title="Yukarı (önceki komut)" onPress={() => pressKey(KEY_SEQ.up)} />
              <KeyBtn label={<ArrowDown size={12} />} title="Aşağı" onPress={() => pressKey(KEY_SEQ.down)} />
              <KeyBtn label={<ArrowLeft size={12} />} title="Sol" onPress={() => pressKey(KEY_SEQ.left)} />
              <KeyBtn label={<ArrowRight size={12} />} title="Sağ" onPress={() => pressKey(KEY_SEQ.right)} />
              <KeyBtn label="|" title="Boru (|)" onPress={() => pressKey("|")} />
              <KeyBtn label="~" title="Tilde (~)" onPress={() => pressKey("~")} />
              <KeyBtn label="/" title="Eğik çizgi (/)" onPress={() => pressKey("/")} />
              <span aria-hidden className="w-px h-4 bg-white/10 mx-1 shrink-0" />
            </>
          )}

          {useWs && bridgeInfo?.outdated && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={updateBridge}
              title={`Köprü sürümü ${bridgeInfo.version ?? "bilinmiyor"} — güncelle: opencode gibi araçlar PATH'te bulunur, renkler düzelir`}
              className="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-md bg-yellow/15 hover:bg-yellow/25 text-yellow text-[11px] font-semibold transition-colors"
            >
              <DownloadCloud size={12} /> Köprüyü güncelle
            </button>
          )}

          {quickCommands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => runQuick(cmd)}
              title={`Çalıştır: ${cmd}`}
              className="shrink-0 h-7 px-2.5 rounded-md border border-white/10 hover:border-green/40 hover:bg-white/5 text-white/60 hover:text-white/90 font-mono text-[11px] whitespace-nowrap transition-colors"
            >
              {quickCommandLabel(cmd)}
            </button>
          ))}

          <div className="flex-1 min-w-2" />
          <KeyBtn
            label="A−"
            title="Yazıyı küçült"
            disabled={fontSize <= TERMINAL_FONT_MIN}
            onPress={() => changeFont(-1)}
          />
          <span className="shrink-0 text-[10px] font-mono text-white/35 tabular-nums w-5 text-center" aria-label={`Yazı boyutu ${fontSize}`}>{fontSize}</span>
          <KeyBtn
            label="A+"
            title="Yazıyı büyüt"
            disabled={fontSize >= TERMINAL_FONT_MAX}
            onPress={() => changeFont(1)}
          />
        </div>
      )}
    </div>
  );
}

/** Tuş şeridi düğmesi. `onPointerDown` preventDefault: dokunma, xterm'in gizli
 *  textarea'sından odağı ÇALMASIN — yoksa iOS klavyeyi her basışta kapatır.
 *  (pointerdown'ı engellemek click'i engellemez; eylem onClick'te.) */
function KeyBtn({
  label, title, onPress, active = false, disabled = false,
}: {
  label: ReactNode;
  title: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={
        "shrink-0 h-7 min-w-8 px-2 grid place-items-center rounded-md font-mono text-[11px] transition-colors disabled:opacity-30 " +
        (active
          ? "bg-green/25 text-green ring-1 ring-green/50"
          : "bg-white/[0.06] hover:bg-white/10 active:bg-white/15 text-white/70")
      }
    >
      {label}
    </button>
  );
}
