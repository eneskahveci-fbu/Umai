import { describe, expect, it } from "vitest";
import {
  applyCtrl,
  BRIDGE_UPDATE_COMMAND,
  clampFontSize,
  healthUrlFromWs,
  isBridgeOutdated,
  MAX_QUICK_COMMANDS,
  parseQuickCommands,
  quickCommandLabel,
  reconnectDelay,
} from "@/lib/terminalKeys";

describe("applyCtrl", () => {
  it("harfleri kontrol koduna çevirir", () => {
    expect(applyCtrl("c")).toBe("\x03");
    expect(applyCtrl("C")).toBe("\x03");
    expect(applyCtrl("a")).toBe("\x01");
    expect(applyCtrl("z")).toBe("\x1a");
    expect(applyCtrl("d")).toBe("\x04");
  });
  it("özel karakterler", () => {
    expect(applyCtrl("[")).toBe("\x1b");
    expect(applyCtrl(" ")).toBe("\x00");
    expect(applyCtrl("?")).toBe("\x7f");
  });
  it("çok karakterli girdiyi ve çevrilemeyeni bozmaz", () => {
    expect(applyCtrl("ls -la")).toBe("ls -la");
    expect(applyCtrl("5")).toBe("5");
    expect(applyCtrl("")).toBe("");
  });
});

describe("reconnectDelay", () => {
  it("üstel artar ve 15 sn'de durur", () => {
    expect([0, 1, 2, 3, 4, 10].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
    expect(reconnectDelay(-3)).toBe(1000);
  });
});

describe("healthUrlFromWs", () => {
  it("wss + token → https /health", () => {
    expect(healthUrlFromWs("wss://1.2.3.4.sslip.io/?token=abc")).toBe("https://1.2.3.4.sslip.io/health");
  });
  it("ws → http, port korunur", () => {
    expect(healthUrlFromWs("ws://localhost:7777/?token=x")).toBe("http://localhost:7777/health");
  });
  it("geçersiz / boş", () => {
    expect(healthUrlFromWs("")).toBeNull();
    expect(healthUrlFromWs("çöp")).toBeNull();
    expect(healthUrlFromWs("ftp://x")).toBeNull();
  });
});

describe("isBridgeOutdated", () => {
  it("sürüm karşılaştırması", () => {
    expect(isBridgeOutdated("2.0.0")).toBe(true);
    expect(isBridgeOutdated("2.1.0")).toBe(false);
    expect(isBridgeOutdated("2.10.0")).toBe(false);
    expect(isBridgeOutdated("3")).toBe(false);
  });
  it("sürüm yoksa eski say", () => {
    expect(isBridgeOutdated(undefined)).toBe(true);
    expect(isBridgeOutdated("beta")).toBe(true);
  });
});

describe("parseQuickCommands", () => {
  it("boşları atar, tekilleştirir, sınırlar", () => {
    expect(parseQuickCommands("opencode\n\n  clear \nopencode\r\nls")).toEqual(["opencode", "clear", "ls"]);
    const many = Array.from({ length: 30 }, (_, i) => `c${i}`).join("\n");
    expect(parseQuickCommands(many)).toHaveLength(MAX_QUICK_COMMANDS);
  });
});

describe("quickCommandLabel", () => {
  it("uzunları kırpar", () => {
    expect(quickCommandLabel("opencode")).toBe("opencode");
    expect(quickCommandLabel("npm install && npm run dev", 10)).toBe("npm insta…");
  });
});

describe("clampFontSize", () => {
  it("sınırlar ve varsayılana düşer", () => {
    expect(clampFontSize(4)).toBe(9);
    expect(clampFontSize(40)).toBe(22);
    expect(clampFontSize(14.6)).toBe(15);
    expect(clampFontSize(undefined)).toBe(13);
  });
});

describe("BRIDGE_UPDATE_COMMAND", () => {
  it("sudo kullanmaz, bozuk indirmeyi canlı dosyaya yazmadan önce kontrol eder", () => {
    expect(BRIDGE_UPDATE_COMMAND).not.toMatch(/\bsudo\b/);
    expect(BRIDGE_UPDATE_COMMAND.indexOf("node --check")).toBeLessThan(BRIDGE_UPDATE_COMMAND.indexOf("mv "));
  });
});
