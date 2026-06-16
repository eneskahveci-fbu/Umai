import { describe, it, expect } from "vitest";
import { mergeChats } from "../store";
import type { Chat, ChatMessage } from "../types";

function chat(id: string, msgCount: number, created = 1, incognito = false): Chat {
  const messages: ChatMessage[] = Array.from({ length: msgCount }, () => ({ role: "user", content: "x" }));
  return { id, title: id, messages, created_at: created, incognito };
}

/* MUTLAK KURAL: giriş yapınca yerel sohbetler EZİLMEZ, buluttakilerle birleşir. */
describe("mergeChats — yerel veri korunur", () => {
  it("ilk giriş (bulut boş): tüm yerel sohbetler korunur ve yüklenir", () => {
    const { merged, toUpload } = mergeChats([chat("a", 2), chat("b", 1)], []);
    expect(merged.map((c) => c.id).sort()).toEqual(["a", "b"]);
    expect(toUpload.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("bulut-only sohbetler korunur (yükleme yok)", () => {
    const { merged, toUpload } = mergeChats([], [chat("c", 3)]);
    expect(merged.map((c) => c.id)).toEqual(["c"]);
    expect(toUpload).toHaveLength(0);
  });

  it("çakışma: yerel daha zengin → yerel kazanır + buluta yüklenir", () => {
    const { merged, toUpload } = mergeChats([chat("a", 5)], [chat("a", 2)]);
    expect(merged[0].messages).toHaveLength(5);
    expect(toUpload.map((c) => c.id)).toEqual(["a"]);
  });

  it("çakışma: bulut daha zengin → bulut kazanır, yükleme yok", () => {
    const { merged, toUpload } = mergeChats([chat("a", 2)], [chat("a", 5)]);
    expect(merged[0].messages).toHaveLength(5);
    expect(toUpload).toHaveLength(0);
  });

  it("gizli (incognito) sohbet buluta gönderilmez", () => {
    const { toUpload } = mergeChats([chat("s", 1, 1, true)], []);
    expect(toUpload).toHaveLength(0);
  });

  it("birleşim created_at'e göre azalan sıralı", () => {
    const { merged } = mergeChats([chat("old", 1, 100)], [chat("new", 1, 200)]);
    expect(merged.map((c) => c.id)).toEqual(["new", "old"]);
  });
});
