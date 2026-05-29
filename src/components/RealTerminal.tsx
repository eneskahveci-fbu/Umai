"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Power, RefreshCw, X } from "lucide-react";
import { getWebContainer, isSupported, mountDefaults } from "@/lib/webcontainer";

type Status = "idle" | "booting" | "ready" | "error";

export function RealTerminal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const cleanupRef = useRef<(() => void) | null>(null);

  const boot = async () => {
    if (!containerRef.current) return;
    if (!isSupported()) {
      setStatus("error");
      setErrMsg("Tarayıcı cross-origin isolation desteklemiyor (Chrome/Edge önerilen).");
      return;
    }
    setStatus("booting");
    setErrMsg("");

    try {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      await import("@xterm/xterm/css/xterm.css");

      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        theme: {
          background: "#0a0a0d",
          foreground: "#ececf1",
          cursor: "#7c5cff",
          selectionBackground: "#7c5cff40",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      const wc = await getWebContainer();
      await mountDefaults(wc);

      term.writeln("\x1b[1;35m▲ craft.ai sandbox\x1b[0m — Node.js + busybox-shell hazır");
      term.writeln("\x1b[2mDeneyin: \x1b[36mls\x1b[2m, \x1b[36mnode -v\x1b[2m, \x1b[36mnpm init -y\x1b[0m\n");

      const proc = await wc.spawn("jsh", { terminal: { cols: term.cols, rows: term.rows } });
      const writer = proc.input.getWriter();

      term.onData((d) => writer.write(d));
      proc.output.pipeTo(new WritableStream({
        write: (chunk) => term.write(chunk),
      })).catch(() => { /* terminal closed */ });

      const resize = () => {
        fit.fit();
        try { proc.resize({ cols: term.cols, rows: term.rows }); } catch { /* not ready */ }
      };
      window.addEventListener("resize", resize);
      const ro = new ResizeObserver(resize);
      ro.observe(containerRef.current);

      setStatus("ready");

      cleanupRef.current = () => {
        window.removeEventListener("resize", resize);
        ro.disconnect();
        try { writer.releaseLock(); } catch { /* ignore */ }
        try { proc.kill(); } catch { /* ignore */ }
        term.dispose();
      };
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

  return (
    <div className="h-64 shrink-0 border-t border-line/60 bg-[#0a0a0d] flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line/40 bg-surface/40 shrink-0">
        <Power size={11} className={
          status === "ready" ? "text-green" :
          status === "booting" ? "text-amber-400 animate-pulse" :
          status === "error" ? "text-red" : "text-muted/40"
        } />
        <span className="text-[11px] font-mono text-muted/70">
          Terminal · {status === "ready" ? "hazır" : status === "booting" ? "başlatılıyor…" : status === "error" ? "hata" : "boşta"}
        </span>
        <div className="flex-1" />
        <button onClick={restart} title="Yeniden başlat" className="text-muted/50 hover:text-ink p-1 rounded transition-colors">
          <RefreshCw size={11} />
        </button>
        <button onClick={onClose} title="Kapat" className="text-muted/50 hover:text-ink p-1 rounded transition-colors">
          <X size={12} />
        </button>
      </div>
      {status === "error" ? (
        <div className="flex-1 grid place-items-center px-6">
          <div className="text-center max-w-md">
            <p className="text-xs text-red mb-2">Terminal başlatılamadı</p>
            <p className="text-[11px] text-muted/60 leading-relaxed mb-3">{errMsg}</p>
            <button onClick={restart} className="text-[11px] px-3 py-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors">
              Tekrar dene
            </button>
          </div>
        </div>
      ) : status === "booting" ? (
        <div className="flex-1 grid place-items-center">
          <div className="flex items-center gap-2 text-xs text-muted/60">
            <Loader2 size={13} className="animate-spin" />
            WebContainer başlatılıyor (ilk açılışta 5-10 sn sürebilir)…
          </div>
        </div>
      ) : null}
      <div ref={containerRef} className="flex-1 min-h-0 px-2 py-1" />
    </div>
  );
}
