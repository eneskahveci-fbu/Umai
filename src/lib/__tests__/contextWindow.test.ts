import { describe, expect, it } from "vitest";
import { pruneMessages, totalContentChars, type PrunableMessage } from "../contextWindow";

const long = (n: number) => "x".repeat(n);

describe("pruneMessages", () => {
  it("son keepRecent mesajı dokunmaz", () => {
    const msgs: PrunableMessage[] = [
      { role: "system", content: long(5000) },
      { role: "user", content: long(5000) },
      { role: "assistant", content: long(5000) },
    ];
    const out = pruneMessages(msgs, { keepRecent: 2, maxContentChars: 100 });
    // son 2 (index 1,2) korunur, index 0 system korunur → hiçbiri kırpılmaz
    expect(out[1].content).toBe(long(5000));
    expect(out[2].content).toBe(long(5000));
  });

  it("eski uzun içeriği kırpar", () => {
    const msgs: PrunableMessage[] = [
      { role: "user", content: long(5000) },
      { role: "assistant", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
    ];
    const out = pruneMessages(msgs, { keepRecent: 2, maxContentChars: 100 });
    expect((out[0].content as string).length).toBeLessThan(5000);
    expect(out[0].content as string).toContain("kısaltıldı");
  });

  it("system (0. mesaj) korunur", () => {
    const msgs: PrunableMessage[] = [
      { role: "system", content: long(5000) },
      { role: "user", content: "x" },
      { role: "user", content: "y" },
      { role: "user", content: "z" },
    ];
    const out = pruneMessages(msgs, { keepRecent: 1, maxContentChars: 100 });
    expect(out[0].content).toBe(long(5000));
  });

  it("kısa içeriği aynen bırakır", () => {
    const msgs: PrunableMessage[] = [
      { role: "user", content: "kısa" },
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ];
    const out = pruneMessages(msgs, { keepRecent: 1, maxContentChars: 100 });
    expect(out[0].content).toBe("kısa");
  });

  it("tool_call_id gibi alanları korur (eşleşme bozulmaz)", () => {
    const msgs: PrunableMessage[] = [
      { role: "tool", tool_call_id: "abc", content: long(5000) },
      { role: "user", content: "1" },
      { role: "user", content: "2" },
    ];
    const out = pruneMessages(msgs, { keepRecent: 1, maxContentChars: 100 });
    expect(out[0].tool_call_id).toBe("abc");
    expect(out[0].role).toBe("tool");
  });

  it("mesaj sayısını değiştirmez (yapı korunur)", () => {
    const msgs: PrunableMessage[] = Array.from({ length: 10 }, (_, i) => ({ role: "user", content: long(5000) + i }));
    expect(pruneMessages(msgs, { keepRecent: 3, maxContentChars: 100 })).toHaveLength(10);
  });
});

describe("totalContentChars", () => {
  it("string içerikleri toplar", () => {
    expect(totalContentChars([{ role: "user", content: "abc" }, { role: "user", content: "de" }])).toBe(5);
  });
  it("string olmayan içeriği yok sayar", () => {
    expect(totalContentChars([{ role: "user", content: 123 }, { role: "user", content: "ab" }])).toBe(2);
  });
});
