/* AI run-command köprüsü — CoderView `craftai:terminal-run` yayar, terminal
   komutu sentinel işaretleriyle çalıştırır, bitince `craftai:terminal-output`
   ile ANSI'den temizlenmiş çıktı + exit code döner (sabit timeout yok; build/
   install/test gibi uzun komutlar da eksiksiz raporlanır). WS ve WebContainer
   taşıyıcıları bu TEK uygulamayı paylaşır. */
import { extractSentinelResult, formatResult, makeSentinel } from "./core";

const RUN_TIMEOUT_MS = 120_000;
const POLL_MS = 300;

export interface RunBridgeIo {
  /** Satırı kabuğa yazar; taşıyıcı hazır değilse false. */
  send: (data: string) => boolean;
  /** O ana kadar biriken ham çıktı (sona eklemeli, kapaklı). */
  buffer: () => string;
}

export function attachRunBridge(io: RunBridgeIo): () => void {
  const polls = new Set<ReturnType<typeof setInterval>>();

  const onRun = (e: Event) => {
    const cmd = (e as CustomEvent<{ command: string }>).detail?.command;
    if (!cmd) return;
    const s = makeSentinel(cmd, Math.random().toString(36).slice(2, 8));
    const from = io.buffer().length;
    if (!io.send(s.line)) return;
    const startedAt = Date.now();
    const poll = setInterval(() => {
      /* Kapak (200K) kuyruğu kaydırmışsa `from` geçersiz olur → tamamına bak. */
      const buf = io.buffer();
      const slice = from <= buf.length ? buf.slice(from) : buf;
      const r = extractSentinelResult(slice, s, Date.now() - startedAt > RUN_TIMEOUT_MS);
      if (!r) return;
      clearInterval(poll);
      polls.delete(poll);
      window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: cmd, output: formatResult(r) } }));
    }, POLL_MS);
    polls.add(poll);
  };

  window.addEventListener("craftai:terminal-run", onRun);
  return () => {
    window.removeEventListener("craftai:terminal-run", onRun);
    /* Terminal kapanınca bekleyen yoklamalar sızmasın. */
    for (const p of polls) clearInterval(p);
    polls.clear();
  };
}
