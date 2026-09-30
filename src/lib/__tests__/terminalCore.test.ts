import { describe, expect, it } from "vitest";
import {
  FONT_DEFAULT, FONT_MAX, FONT_MIN, HEIGHT_DEFAULT, HEIGHT_MIN, RESULT_MAX,
  appendCapped, clampFont, clampHeight, extractSentinelResult, formatResult,
  hostLabel, makeSentinel, normalizeWsUrl, stripAnsi,
} from "@/lib/terminal/core";

describe("normalizeWsUrl", () => {
  it("https → wss, http → ws", () => {
    expect(normalizeWsUrl("https://a.com/?token=x", false)).toEqual({ url: "wss://a.com/?token=x" });
    expect(normalizeWsUrl("http://a.com", false)).toEqual({ url: "ws://a.com" });
  });
  it("HTTPS sayfada ws:// → wss:// yükseltir", () => {
    expect(normalizeWsUrl("ws://a.com", true)).toEqual({ url: "wss://a.com" });
    expect(normalizeWsUrl("ws://a.com", false)).toEqual({ url: "ws://a.com" });
  });
  it("geçersiz adreste hata döner", () => {
    expect("error" in normalizeWsUrl("a.com", false)).toBe(true);
    expect("error" in normalizeWsUrl("wss://", false)).toBe(true);
  });
});

describe("hostLabel", () => {
  it("token'ı göstermez, yalnız host", () => {
    expect(hostLabel("wss://t.example.com/?token=secret")).toBe("t.example.com");
    expect(hostLabel("bozuk")).toBe("ws");
  });
});

describe("stripAnsi", () => {
  it("CSI/OSC dizilerini ve \\r'yi temizler", () => {
    expect(stripAnsi("\x1b[1;32mok\x1b[0m\r\n\x1b]0;başlık\x07son")).toBe("ok\nson");
  });
});

describe("appendCapped", () => {
  it("kuyruğu sınırda tutar", () => {
    expect(appendCapped("abc", "def", 4)).toBe("cdef");
    expect(appendCapped("a", "b", 4)).toBe("ab");
  });
});

describe("sentinel", () => {
  const s = makeSentinel("npm test", "abc123");
  it("komutu işaretlerle sarar", () => {
    expect(s.line).toBe(`printf '__CRAFT_S_abc123__\\n'; npm test; printf '__CRAFT_D_abc123__:%s\\n' "$?"\n`);
  });
  it("bitmeden null döner (yankı DONE:%s eşleşmez)", () => {
    const echo = s.line.replace(/\n$/, "\r\n");
    expect(extractSentinelResult(echo + "__CRAFT_S_abc123__\r\nçalışıyor", s, false)).toBeNull();
  });
  it("çıktıyı ve exit kodunu ayıklar", () => {
    const echo = s.line.replace(/\n$/, "\r\n");
    const out = `${echo}__CRAFT_S_abc123__\r\n\x1b[32m✓ 3 test\x1b[0m\r\n__CRAFT_D_abc123__:1\r\n$ `;
    expect(extractSentinelResult(out, s, false)).toEqual({ output: "✓ 3 test", code: "1" });
  });
  it("zaman aşımında eldeki çıktıyı verir", () => {
    expect(extractSentinelResult("__CRAFT_S_abc123__\nyarım", s, true)).toEqual({ output: "yarım", code: "timeout" });
  });
  it("formatResult boş çıktıyı ve sınırı ele alır", () => {
    expect(formatResult({ output: "", code: "0" })).toBe("(çıktı yok)\n[exit: 0]");
    expect(formatResult({ output: "x".repeat(10_000), code: "0" }).length).toBe(RESULT_MAX);
  });
});

describe("clampHeight / clampFont", () => {
  it("bozuk değerde varsayılana düşer", () => {
    expect(clampHeight(null, 1000)).toBe(HEIGHT_DEFAULT);
    expect(clampHeight("abc", 1000)).toBe(HEIGHT_DEFAULT);
    expect(clampFont(undefined)).toBe(FONT_DEFAULT);
  });
  it("sınırlar içinde tutar", () => {
    expect(clampHeight(10, 1000)).toBe(HEIGHT_MIN);
    expect(clampHeight(5000, 1000)).toBe(850);
    expect(clampHeight("300", 1000)).toBe(300);
    expect(clampFont(2)).toBe(FONT_MIN);
    expect(clampFont(99)).toBe(FONT_MAX);
  });
});
