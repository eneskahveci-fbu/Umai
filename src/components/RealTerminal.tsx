"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, ExternalLink, FolderOpen, Loader2, Power, RefreshCw, Settings as SettingsIcon, X } from "lucide-react";
import { getUnsupportedReason, getWebContainer, isSupported, mountDefaults, needsApiKey } from "@/lib/webcontainer";
import {
  dirHandleToTree,
  getMountedHandle,
  getMountedName,
  isLocalFsSupported,
  pickLocalDirectory,
  setMounted,
} from "@/lib/localfs";
import { useStore } from "@/lib/store";

function codespaceUrl(owner: string, repo: string, branch?: string): string {
  const u = new URL("https://github.com/codespaces/new");
  u.searchParams.set("repo", `${owner}/${repo}`);
  if (branch) u.searchParams.set("ref", branch);
  return u.toString();
}

type Status = "idle" | "booting" | "ready" | "error" | "needs-key";

/* ── WebSocket PTY mode ─────────────────────────────────────────────
   Connects to a remote terminal-server (ws/wss URL).
   Protocol: client sends JSON {type:"input",data:"..."} | {type:"resize",cols,rows}
             server sends JSON {type:"output",data:"..."} ── */
async function bootWsTerminal(
  containerEl: HTMLDivElement,
  wsUrl: string,
  appTheme: "dark" | "light",
  onReady: () => void,
  onError: (msg: string) => void,
): Promise<() => void> {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);
  await import("@xterm/xterm/css/xterm.css");

  const isLight = appTheme === "light";
  const term = new Terminal({
    convertEol: true, cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    theme: {
      background: isLight ? "#211d16" : "#0e0d0a",
      foreground: "#f0ebe0", cursor: "#c8a87e",
      selectionBackground: "#c8a87e40",
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(containerEl);
  fit.fit();

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    onReady();
  };
  ws.onerror = () => onError("Sunucuya bağlanılamadı. URL'i ve token'ı kontrol et.");
  ws.onclose = (ev) => {
    if (ev.code === 4403) { onError("Erişim reddedildi — token geçersiz."); return; }
    term.writeln("\r\n\x1b[33m[Bağlantı kapandı]\x1b[0m");
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { type: string; data?: string };
      if (msg.type === "output" && msg.data) term.write(msg.data);
    } catch { term.write(ev.data as string); }
  };

  term.onData((d) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", data: d }));
  });

  const resize = () => {
    fit.fit();
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
  };
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize);
  ro.observe(containerEl);

  /* AI run-command bridge */
  let outputBuffer = "";
  const origOnMsg = ws.onmessage;
  ws.onmessage = (ev) => {
    origOnMsg?.call(ws, ev);
    try {
      const msg = JSON.parse(ev.data as string) as { type: string; data?: string };
      if (msg.type === "output" && msg.data) {
        outputBuffer += msg.data;
        if (outputBuffer.length > 4000) outputBuffer = outputBuffer.slice(-4000);
      }
    } catch { /* ignore */ }
  };
  const handleRunCmd = (e: Event) => {
    const cmd = (e as CustomEvent<{ command: string }>).detail?.command;
    if (!cmd || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "input", data: cmd + "\n" }));
    setTimeout(() => {
      const out = outputBuffer.slice(-2000).trim();
      if (out) window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: cmd, output: out } }));
    }, 3000);
  };
  window.addEventListener("craftai:terminal-run", handleRunCmd);

  return () => {
    window.removeEventListener("craftai:terminal-run", handleRunCmd);
    window.removeEventListener("resize", resize);
    ro.disconnect();
    ws.close();
    term.dispose();
  };
}

/* ── WebContainer mode (mevcut) ─────────────────────────────────── */
async function bootWcTerminal(
  containerEl: HTMLDivElement,
  apiKey: string,
  appTheme: "dark" | "light",
  onReady: () => void,
  onError: (msg: string) => void,
  onNeedsKey: () => void,
): Promise<() => void> {
  if (!isSupported()) { onError(getUnsupportedReason() ?? "Tarayıcı desteklemiyor."); return () => {}; }
  if (needsApiKey() && !apiKey.trim()) { onNeedsKey(); return () => {}; }

  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);
  await import("@xterm/xterm/css/xterm.css");

  const isLight = appTheme === "light";
  const term = new Terminal({
    convertEol: true, cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    theme: {
      background: isLight ? "#211d16" : "#0e0d0a",
      foreground: "#f0ebe0", cursor: "#c8a87e",
      selectionBackground: "#c8a87e40",
      black: "#1c1917", brightBlack: "#4a4540",
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(containerEl);
  fit.fit();

  const wc = await getWebContainer(apiKey);
  const handle = getMountedHandle();
  if (handle) {
    const { tree, fileCount, truncated, skipped } = await dirHandleToTree(handle);
    await wc.mount(tree);
    term.writeln(`\x1b[1;32m✓ Mount: \x1b[36m${getMountedName()}\x1b[0m (${fileCount} dosya${truncated ? ", \x1b[33mkesildi\x1b[0m" : ""})`);
    if (skipped.length > 0) term.writeln(`\x1b[33m⚠ Atlandı (>5MB): ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ` ve ${skipped.length - 3} daha` : ""}\x1b[0m`);
  } else {
    await mountDefaults(wc);
  }
  term.writeln("\x1b[1;35m▲ Craft.Coder sandbox\x1b[0m — Node.js + busybox-shell hazır");
  term.writeln("\x1b[2mDeneyin: \x1b[36mls\x1b[2m, \x1b[36mnode -v\x1b[2m, \x1b[36mnpm init -y\x1b[0m\n");

  const proc = await wc.spawn("jsh", { terminal: { cols: term.cols, rows: term.rows } });
  const writer = proc.input.getWriter();
  term.onData((d) => writer.write(d));

  let outputBuffer = "";
  proc.output.pipeTo(new WritableStream({
    write: (chunk) => {
      term.write(chunk);
      outputBuffer += chunk;
      if (outputBuffer.length > 4000) outputBuffer = outputBuffer.slice(-4000);
    },
  })).catch(() => {});

  const handleRunCmd = (e: Event) => {
    const cmd = (e as CustomEvent<{ command: string }>).detail?.command;
    if (!cmd) return;
    writer.write(cmd + "\n");
    setTimeout(() => {
      const out = outputBuffer.slice(-2000).trim();
      if (out) window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: cmd, output: out } }));
    }, 3000);
  };
  window.addEventListener("craftai:terminal-run", handleRunCmd);

  const resize = () => {
    fit.fit();
    try { proc.resize({ cols: term.cols, rows: term.rows }); } catch { /* not ready */ }
  };
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize);
  ro.observe(containerEl);
  onReady();

  return () => {
    window.removeEventListener("craftai:terminal-run", handleRunCmd);
    window.removeEventListener("resize", resize);
    ro.disconnect();
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
  const apiKey = useStore((s) => s.config.webcontainerApiKey);
  const wsUrl = useStore((s) => s.config.terminalWsUrl ?? "");
  const appTheme = useStore((s) => s.config.theme);
  const appThemeRef = useRef(appTheme);
  useEffect(() => { appThemeRef.current = appTheme; }, [appTheme]);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const addToast = useStore((s) => s.addToast);
  const repo = useStore((s) => s.repo);
  const codespaceHref = repo ? codespaceUrl(repo.owner, repo.repo, repo.branch) : null;
  const useWs = wsUrl.trim().length > 0;

  useEffect(() => {
    const fn = () => setMountedFolder(getMountedName());
    window.addEventListener("localfs:changed", fn);
    return () => window.removeEventListener("localfs:changed", fn);
  }, []);

  const boot = async () => {
    if (!containerRef.current) return;
    setStatus("booting");
    setErrMsg("");
    try {
      const cleanup = useWs
        ? await bootWsTerminal(
            containerRef.current, wsUrl, appThemeRef.current,
            () => setStatus("ready"),
            (msg) => { setStatus("error"); setErrMsg(msg); },
          )
        : await bootWcTerminal(
            containerRef.current, apiKey, appThemeRef.current,
            () => setStatus("ready"),
            (msg) => { setStatus("error"); setErrMsg(msg); },
            () => setStatus("needs-key"),
          );
      cleanupRef.current = cleanup;
    } catch (e) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  };

  useEffect(() => {
    boot();
    return () => { cleanupRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = () => {
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

  const modeLabel = useWs
    ? `Uzak (${(() => { try { return new URL(wsUrl).hostname; } catch { return "ws"; } })()})`
    : "WebContainer";

  return (
    <div
      className="h-64 shrink-0 border-t border-line/60 flex flex-col"
      style={{ backgroundColor: appTheme === "light" ? "#211d16" : "#0e0d0a" }}
    >
      {/* Terminal toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line/30 bg-black/20 shrink-0">
        <Power size={11} className={
          status === "ready" ? "text-green" :
          status === "booting" ? "text-amber-400 animate-pulse" :
          status === "error" ? "text-red" : "text-white/30"
        } />
        <span className="text-[11px] font-mono text-white/50 truncate max-w-[140px]">
          {modeLabel} · {
            status === "ready" ? "hazır" :
            status === "booting" ? "bağlanıyor…" :
            status === "error" ? "hata" :
            status === "needs-key" ? "key gerekli" : "boşta"
          }
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
              {" "}üzerinden al → Ayarlar → Gelişmiş.{" "}
              <strong className="text-white/60">Ya da kendi sunucunu bağla (Ayarlar → Terminal).</strong>
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-branddim transition-colors font-semibold">
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
        <div className="flex-1 grid place-items-center px-6">
          <div className="text-center max-w-md">
            <p className="text-xs text-red mb-1.5">Terminal başlatılamadı</p>
            <p className="text-[11px] text-white/40 leading-relaxed mb-3">{errMsg}</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {useWs ? (
                <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-branddim transition-colors font-semibold">
                  <SettingsIcon size={11} /> Ayarlar
                </button>
              ) : codespaceHref ? (
                <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-branddim transition-colors font-semibold">
                  <Cloud size={11} /> Codespaces&apos;te aç
                </a>
              ) : (
                <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-branddim transition-colors font-semibold">
                  <SettingsIcon size={11} /> Sunucu bağla
                </button>
              )}
              <button onClick={restart} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors">
                Tekrar dene
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "booting" && (
        <div className="flex-1 grid place-items-center">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 size={13} className="animate-spin" />
            {useWs ? "Uzak sunucuya bağlanılıyor…" : "WebContainer başlatılıyor (5-10 sn sürebilir)…"}
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

      <div ref={containerRef} className="flex-1 min-h-0 px-2 py-1" />
    </div>
  );
}
