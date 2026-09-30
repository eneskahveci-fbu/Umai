/* Düz sohbet (zero-copy) yolu için DAYANIKLI akış. Yanıt BAŞLIKLARI gelen bir aday
   bazen hiçbir şey üretmez (boş içerik, yalnız muhakeme ve bitiş, ya da ilk içerik
   çok geç gelir). Kullanıcıya "boş yanıt" göstermek yerine aynı akışın İÇİNDE sıradaki
   adaya geçilir. Baytlar geldiği gibi iletilir (muhakeme paneli canlı kalır); yalnız
   ilk İÇERİK görülene kadar küçük bir regex ile bakılır, sonrası saf zero-copy. İstemci
   `[DONE]` satırlarını zaten atlar, bu yüzden akışları art arda eklemek güvenlidir. */
const CONTENT_SEEN_RE = /"(?:content|tool_calls)"\s*:\s*(?:"[^"]|\[)/;
export function withFailover(opts: {
  body: ReadableStream<Uint8Array>;
  hasNext: () => boolean;
  nextStream: () => Promise<{ body: ReadableStream<Uint8Array>; event: Uint8Array } | null>;
  firstContentTimeoutMs: number;
  prefix?: Uint8Array;
}): ReadableStream<Uint8Array> {
  let reader = opts.body.getReader();
  const decoder = new TextDecoder();
  let sawContent = false;
  let startedAt = Date.now();
  let tail = "";
  let prefix = opts.prefix;
  const restart = async (controller: ReadableStreamDefaultController<Uint8Array>): Promise<boolean> => {
    const next = await opts.nextStream();
    if (!next) return false;
    reader = next.body.getReader();
    startedAt = Date.now();
    tail = "";
    controller.enqueue(next.event);
    return true;
  };
  return new ReadableStream<Uint8Array>({
    start(controller) { if (prefix) { controller.enqueue(prefix); prefix = undefined; } },
    async pull(controller) {
      for (;;) {
        let result: ReadableStreamReadResult<Uint8Array> | "stalled";
        if (!sawContent && opts.hasNext()) {
          const left = Math.max(1, opts.firstContentTimeoutMs - (Date.now() - startedAt));
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<"stalled">((resolve) => { timer = setTimeout(() => resolve("stalled"), left); });
          result = await Promise.race([reader.read(), timeout]);
          clearTimeout(timer);
        } else {
          result = await reader.read();
        }
        if (result === "stalled") {
          void reader.cancel().catch(() => {});
          if (await restart(controller)) continue;
          controller.close();
          return;
        }
        if (result.done) {
          if (!sawContent && opts.hasNext() && (await restart(controller))) continue;
          controller.close();
          return;
        }
        if (!sawContent) {
          tail = (tail + decoder.decode(result.value, { stream: true })).slice(-4096);
          if (CONTENT_SEEN_RE.test(tail)) sawContent = true;
        }
        controller.enqueue(result.value);
        return;
      }
    },
    cancel(reason) { void reader.cancel(reason).catch(() => {}); },
  });
}
