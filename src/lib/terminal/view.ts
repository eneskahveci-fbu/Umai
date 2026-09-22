/* xterm görünümü — terminal + fit/arama/tıklanabilir-link eklentileri.
   Taşıyıcıdan (WS/WebContainer) bağımsız; RealTerminal bir kez kurar, taşıyıcı
   yalnız veriyi bağlar. */
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { SearchAddon } from "@xterm/addon-search";
import { TERMINAL_FONT, xtermTheme } from "./core";

export interface TerminalView {
  term: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  /** Kabın boyutu değişince çağrılır (fit + taşıyıcıya resize). */
  onResize: (fn: (cols: number, rows: number) => void) => void;
  dispose: () => void;
}

export async function createTerminalView(
  el: HTMLDivElement,
  /* convertEol: gerçek PTY (uzak köprü) zaten \r\n üretir; \n'yi \r\n'ye çevirmek
     opencode/vim gibi tam ekran TUI'lerin imleç konumlandırmasını bozar → yalnız
     WebContainer'da açık. */
  opts: { theme: "dark" | "light"; fontSize: number; convertEol: boolean },
): Promise<TerminalView> {
  const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-search"),
    import("@xterm/addon-web-links"),
  ]);
  await import("@xterm/xterm/css/xterm.css");

  const term = new Terminal({
    convertEol: opts.convertEol,
    cursorBlink: true,
    fontFamily: TERMINAL_FONT,
    fontSize: opts.fontSize,
    scrollback: 5000,
    theme: xtermTheme(opts.theme),
  });
  const fit = new FitAddon();
  const search = new SearchAddon();
  term.loadAddon(fit);
  term.loadAddon(search);
  /* `npm run dev` → http://localhost:3000 gibi adresler tıklanabilir olur. */
  term.loadAddon(new WebLinksAddon());
  term.open(el);
  safeFit(fit);

  const listeners: ((c: number, r: number) => void)[] = [];
  const resize = () => {
    /* Gizli (display:none) kapta fit 0 boyut üretir → atla, açılınca RO tetikler. */
    if (el.clientWidth === 0 || el.clientHeight === 0) return;
    safeFit(fit);
    for (const fn of listeners) fn(term.cols, term.rows);
  };
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return {
    term,
    fit,
    search,
    onResize: (fn) => { listeners.push(fn); },
    dispose: () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
      term.dispose();
    },
  };
}

function safeFit(fit: FitAddon) {
  try { fit.fit(); } catch { /* kap henüz ölçülemiyor */ }
}
