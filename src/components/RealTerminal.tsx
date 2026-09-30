"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown, ChevronUp, Cloud, Eraser, ExternalLink, FolderOpen, Loader2, Maximize2, Minimize2,
  Power, RefreshCw, Search, Settings as SettingsIcon, X,
} from "lucide-react";
import {
  FONT_DEFAULT, HEIGHT_MIN, clampFont, clampHeight, hostLabel, terminalBackground,
} from "@/lib/terminal/core";
import { createTerminalView, type TerminalView } from "@/lib/terminal/view";
import { connectWs } from "@/lib/terminal/wsTransport";
import { connectWebContainer, loadConnectedRepoFiles, webContainerBlocker } from "@/lib/terminal/wcTransport";
import { getMountedName, isLocalFsSupported, pickLocalDirectory, setMounted } from "@/lib/localfs";
import { useStore } from "@/lib/store";

/* Terminal görünümü: yalnız UI. Taşıyıcılar (uzak WS PTY / WebContainer), xterm
   kurulumu ve AI run-command köprüsü `src/lib/terminal/*` altında ayrı modüller. */

type Status = "idle" | "booting" | "ready" | "error" | "needs-key" | "closed";

const HEIGHT_KEY = "craftai_terminal_h";
const FONT_KEY = "craftai_terminal_font";

function readPref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePref(key: string, v: number) {
  try { localStorage.setItem(key, String(v)); } catch { /* gizli pencere vb. */ }
}

function codespaceUrl(owner: string, repo: string, branch?: string): string {
  const u = new URL("https://github.com/codespaces/new");
  u.searchParams.set("repo", `${owner}/${repo}`);
  if (branch) u.searchParams.set("ref", branch);
  return u.toString();
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "boşta", booting: "bağlanıyor…", ready: "hazır", error: "hata", "needs-key": "key gerekli", closed: "bağlantı koptu",
};

const iconBtn = "text-white/40 hover:text-white/80 w-7 h-7 grid place-items-center rounded transition-colors disabled:opacity-30";
const primaryBtn = "flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors font-semibold";

export function RealTerminal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<TerminalView | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const bootSeq = useRef(0);

  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [mountedFolder, setMountedFolder] = useState<string | null>(getMountedName());
  const [mounting, setMounting] = useState(false);
  const [height, setHeight] = useState(() => clampHeight(readPref(HEIGHT_KEY), typeof window === "undefined" ? 800 : window.innerHeight));
  const [maximized, setMaximized] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef(clampFont(readPref(FONT_KEY)));

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
  const modeLabel = useWs ? `Uzak (${hostLabel(wsUrl)})` : "WebContainer";

  useEffect(() => {
    const fn = () => setMountedFolder(getMountedName());
    window.addEventListener("localfs:changed", fn);
    return () => window.removeEventListener("localfs:changed", fn);
  }, []);

  /* Hazır olunca haber ver → CoderView run_command'ı tam o an gönderir (kayıp yok). */
  useEffect(() => {
    if (status === "ready") window.dispatchEvent(new Event("craftai:terminal-ready"));
  }, [status]);

  /* Süren bir boot'u geçersiz kıl — geç gelen sonuçlar state'e dokunmaz. */
  const cancelBoot = () => { bootSeq.current++; };

  const teardown = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    viewRef.current?.dispose();
    viewRef.current = null;
  };

  const setFont = useCallback((next: number) => {
    const v = clampFont(next);
    fontRef.current = v;
    writePref(FONT_KEY, v);
    const view = viewRef.current;
    if (!view) return;
    view.term.options.fontSize = v;
    try { view.fit.fit(); } catch { /* yoksay */ }
  }, []);

  const boot = async () => {
    const el = containerRef.current;
    if (!el) return;
    const seq = ++bootSeq.current;
    const alive = () => seq === bootSeq.current;
    setStatus("booting");
    setErrMsg("");
    const fail = (msg: string) => { if (alive()) { setStatus("error"); setErrMsg(msg); } };

    if (!useWs) {
      const blocker = webContainerBlocker(apiKey);
      if (blocker === "needs-key") { setStatus("needs-key"); return; }
      if (blocker) { fail(blocker.error); return; }
    }

    try {
      const view = await createTerminalView(el, { theme: appThemeRef.current, fontSize: fontRef.current, convertEol: !useWs });
      if (!alive()) { view.dispose(); return; }
      viewRef.current = view;
      view.term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.shiftKey && e.code === "KeyF") { setSearchOpen(true); return false; }
        if (mod && e.shiftKey && e.code === "KeyC") {
          const sel = view.term.getSelection();
          if (sel) void navigator.clipboard?.writeText(sel).catch(() => {});
          return false;
        }
        if (mod && e.shiftKey && e.code === "Equal") { setFont(fontRef.current + 1); return false; }
        if (mod && e.shiftKey && e.code === "Minus") { setFont(fontRef.current - 1); return false; }
        if (mod && e.shiftKey && e.code === "Digit0") { setFont(FONT_DEFAULT); return false; }
        return true;
      });

      const cb = {
        onReady: () => { if (alive()) setStatus("ready"); },
        onError: fail,
        onClosed: () => { if (alive()) setStatus("closed"); },
      };
      const cleanup = useWs
        ? connectWs(view, wsUrl, cb)
        : await connectWebContainer(view, apiKey, cb, loadConnectedRepoFiles);
      if (!alive()) { cleanup(); return; }
      cleanupRef.current = cleanup;
    } catch (e) {
      fail((e as Error).message);
    }
  };

  useEffect(() => {
    /* boot() ilk await'ten önce senkron setStatus çağırır; effect gövdesinde
       doğrudan çağırmak yerine bir tık erteleyerek "cascading render" uyarısını
       önleriz (davranış aynı — terminal yine mount'ta başlar). */
    const id = setTimeout(() => { void boot(); }, 0);
    return () => { clearTimeout(id); cancelBoot(); teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = () => {
    teardown();
    void boot();
  };

  /* ── Yükseklik: üst kenardan sürükle, cihazda hatırla ── */
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = maximized ? Math.round(window.innerHeight * 0.8) : height;
    setMaximized(false);
    let last = startH;
    const move = (ev: PointerEvent) => {
      last = clampHeight(startH + (startY - ev.clientY), window.innerHeight);
      setHeight(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      writePref(HEIGHT_KEY, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const nudgeHeight = (delta: number) => {
    const next = clampHeight(height + delta, window.innerHeight);
    setHeight(next);
    writePref(HEIGHT_KEY, next);
  };

  /* ── Arama ── */
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  const find = (dir: "next" | "prev") => {
    const s = viewRef.current?.search;
    if (!s || !query) return;
    if (dir === "next") s.findNext(query);
    else s.findPrevious(query);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    viewRef.current?.search.clearDecorations();
    viewRef.current?.term.focus();
  };

  const clearScreen = () => {
    viewRef.current?.term.clear();
    viewRef.current?.term.focus();
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

  const panelHeight = maximized ? "80dvh" : `${Math.max(HEIGHT_MIN, height)}px`;
  /* Engelleyici durumlar terminali örter; açılış sırasında ise xterm görünür kalır
     (WebContainer mount ilerlemesini oraya yazar) ve yalnız küçük bir rozet çıkar. */
  const overlay = status === "needs-key" || status === "error";
  const hasTerm = status === "ready" || status === "closed";

  return (
    <div
      className="shrink-0 border-t border-line/60 flex flex-col relative"
      style={{ backgroundColor: terminalBackground(appTheme), height: panelHeight }}
    >
      {/* Boyutlandırma tutamacı */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Terminal yüksekliği"
        aria-valuenow={Math.round(height)}
        tabIndex={0}
        onPointerDown={onDragStart}
        onDoubleClick={() => setMaximized((m) => !m)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); nudgeHeight(24); }
          if (e.key === "ArrowDown") { e.preventDefault(); nudgeHeight(-24); }
        }}
        className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-10 hover:bg-brand/30 focus-visible:bg-brand/40 transition-colors"
      />

      {/* Araç çubuğu */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-line/30 bg-black/20 shrink-0">
        <Power size={11} className={
          status === "ready" ? "text-green" :
          status === "booting" ? "text-yellow animate-pulse" :
          status === "error" || status === "closed" ? "text-red" : "text-white/30"
        } />
        <span className="ml-1 text-[11px] font-mono text-white/50 truncate max-w-[260px]" title={`${modeLabel} · ${STATUS_LABEL[status]}`}>
          {modeLabel} · {STATUS_LABEL[status]}
        </span>
        {!useWs && mountedFolder && (
          <button
            onClick={unmountFolder}
            title="Klasörü kaldır"
            className="ml-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green/15 hover:bg-green/25 text-green/90 font-mono transition-colors"
          >
            <FolderOpen size={10} /> {mountedFolder} <X size={9} className="opacity-60" />
          </button>
        )}
        {status === "closed" && (
          <button onClick={restart} className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow/15 hover:bg-yellow/25 text-yellow transition-colors">
            Yeniden bağlan
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => setSearchOpen((o) => !o)} disabled={!hasTerm} title="Ara (Ctrl+Shift+F)" aria-label="Terminalde ara" className={iconBtn}>
          <Search size={11} />
        </button>
        <button onClick={clearScreen} disabled={!hasTerm} title="Ekranı temizle" aria-label="Ekranı temizle" className={iconBtn}>
          <Eraser size={11} />
        </button>
        {codespaceHref && (
          <a href={codespaceHref} target="_blank" rel="noopener noreferrer" title={`GitHub Codespaces'te aç — ${repo!.owner}/${repo!.repo}`} className={iconBtn}>
            <Cloud size={11} />
          </a>
        )}
        {!useWs && (
          <button onClick={mountFolder} disabled={mounting} aria-label="Yerel klasör mount et" title={mountedFolder ? "Başka klasör seç" : "Yerel klasör mount et"} className={iconBtn}>
            {mounting ? <Loader2 size={11} className="animate-spin" /> : <FolderOpen size={11} />}
          </button>
        )}
        <button onClick={() => setSettingsOpen(true)} title="Terminal ayarları" aria-label="Terminal ayarları" className={iconBtn}>
          <SettingsIcon size={11} />
        </button>
        <button onClick={restart} title="Yeniden başlat" aria-label="Yeniden başlat" className={iconBtn}>
          <RefreshCw size={11} />
        </button>
        <button onClick={() => setMaximized((m) => !m)} title={maximized ? "Küçült" : "Büyüt"} aria-label={maximized ? "Küçült" : "Büyüt"} className={iconBtn}>
          {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>
        <button onClick={onClose} title="Kapat" aria-label="Terminali kapat" className={iconBtn}>
          <X size={12} />
        </button>
      </div>

      {/* Arama çubuğu */}
      {searchOpen && (
        <div className="flex items-center gap-1 px-3 py-1 border-b border-line/30 bg-black/30 shrink-0">
          <Search size={11} className="text-white/40" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); find(e.shiftKey ? "prev" : "next"); }
              if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
            }}
            placeholder="Çıktıda ara… (Enter: sonraki, Shift+Enter: önceki)"
            aria-label="Terminal çıktısında ara"
            className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-white/80 placeholder:text-white/30 outline-none"
          />
          <button onClick={() => find("prev")} title="Önceki" aria-label="Önceki eşleşme" className={iconBtn}><ChevronUp size={12} /></button>
          <button onClick={() => find("next")} title="Sonraki" aria-label="Sonraki eşleşme" className={iconBtn}><ChevronDown size={12} /></button>
          <button onClick={closeSearch} title="Kapat (Esc)" aria-label="Aramayı kapat" className={iconBtn}><X size={11} /></button>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <div
          ref={containerRef}
          role="group"
          aria-label={`Terminal — ${modeLabel}`}
          className={`absolute inset-0 px-2 py-1 ${overlay ? "invisible" : ""}`}
        />

        {overlay && (
          <div className="absolute inset-0 grid place-items-center px-6 overflow-auto">
            {status === "needs-key" && (
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
                  <button onClick={() => setSettingsOpen(true)} className={primaryBtn}>
                    <SettingsIcon size={11} /> Ayarlar
                  </button>
                  {codespaceHref && (
                    <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white/90 transition-colors font-semibold">
                      <Cloud size={11} /> Codespaces&apos;te aç
                    </a>
                  )}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="text-center max-w-md">
                <p className="text-xs text-red mb-1.5">Terminal başlatılamadı</p>
                <p className="text-[11px] text-white/40 leading-relaxed mb-3">{errMsg}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {!useWs && codespaceHref ? (
                    <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
                      <Cloud size={11} /> Codespaces&apos;te aç
                    </a>
                  ) : (
                    <button onClick={() => setSettingsOpen(true)} className={primaryBtn}>
                      <SettingsIcon size={11} /> {useWs ? "Ayarlar" : "Sunucu bağla"}
                    </button>
                  )}
                  <button onClick={restart} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors">
                    Tekrar dene
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {(status === "booting" || status === "idle") && (
          <div className="absolute bottom-2 right-3 flex items-center gap-2 text-[11px] text-white/50 bg-black/40 rounded-md px-2 py-1">
            <Loader2 size={12} className="animate-spin" />
            {status === "idle" ? "Terminal hazırlanıyor…" : useWs ? "Uzak sunucuya bağlanılıyor…" : "WebContainer başlatılıyor (5-10 sn sürebilir)…"}
            {codespaceHref && status === "idle" && (
              <a href={codespaceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/60 hover:text-white/90">
                <ExternalLink size={11} /> Codespaces
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
