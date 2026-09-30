import { describe, it, expect } from "vitest";
import { withFailover } from "../streamFailover";

const enc = new TextEncoder();
const sse = (...lines: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) { for (const l of lines) c.enqueue(enc.encode(`data: ${l}\n\n`)); c.close(); },
  });
const hang = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode(":ok\n\n")); } });
const text = async (s: ReadableStream<Uint8Array>) => {
  const r = s.getReader(); const d = new TextDecoder(); let out = "";
  for (;;) { const { done, value } = await r.read(); if (done) break; out += d.decode(value); }
  return out;
};
const content = (t: string) => JSON.stringify({ choices: [{ delta: { content: t } }] });
const event = enc.encode('data: {"fallback_event":{}}\n\n');

describe("withFailover", () => {
  it("içerik gelen akışı olduğu gibi iletir, yedeğe geçmez", async () => {
    let asked = 0;
    const out = await text(withFailover({
      body: sse(content("merhaba"), "[DONE]"), hasNext: () => true, firstContentTimeoutMs: 1000,
      nextStream: async () => { asked++; return null; },
    }));
    expect(out).toContain("merhaba");
    expect(asked).toBe(0);
  });

  it("boş (yalnız muhakeme) akışta sıradaki adaya geçer", async () => {
    const out = await text(withFailover({
      body: sse(JSON.stringify({ choices: [{ delta: { reasoning: "hmm" } }] }), "[DONE]"),
      hasNext: () => true, firstContentTimeoutMs: 1000,
      nextStream: async () => ({ body: sse(content("yedek"), "[DONE]"), event }),
    }));
    expect(out).toContain("fallback_event");
    expect(out).toContain("yedek");
  });

  it("takılan akışı zaman aşımında bırakıp yedeğe geçer", async () => {
    const t0 = Date.now();
    const out = await text(withFailover({
      body: hang(), hasNext: () => true, firstContentTimeoutMs: 150,
      nextStream: async () => ({ body: sse(content("yedek"), "[DONE]"), event }),
    }));
    expect(out).toContain("yedek");
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("yedek kalmadıysa boş akışı olduğu gibi kapatır", async () => {
    const out = await text(withFailover({
      body: sse("[DONE]"), hasNext: () => false, nextStream: async () => null, firstContentTimeoutMs: 0,
    }));
    expect(out).toContain("[DONE]");
  });
});
