import { describe, expect, it } from "vitest";
import {
  isLoopbackWsUrl,
  LOCAL_TERMINAL_WS,
  resolveTerminalWsUrl,
  terminalHostLabel,
} from "../terminalAccess";

describe("isLoopbackWsUrl", () => {
  it("localhost ve loopback adreslerini tanır", () => {
    expect(isLoopbackWsUrl("ws://localhost:7071/?token=x")).toBe(true);
    expect(isLoopbackWsUrl("ws://127.0.0.1:7071")).toBe(true);
    expect(isLoopbackWsUrl("ws://[::1]:7071/?token=x")).toBe(true);
    expect(isLoopbackWsUrl("http://localhost:4319")).toBe(true);
    expect(isLoopbackWsUrl("app.localhost:3000")).toBe(false); // şema yok → geçersiz
    expect(isLoopbackWsUrl("ws://app.localhost:7071")).toBe(true);
  });

  it("uzak adresleri yerel saymaz", () => {
    expect(isLoopbackWsUrl("wss://terminal.example.com/?token=x")).toBe(false);
    expect(isLoopbackWsUrl("wss://89.168.1.2:7071/?token=x")).toBe(false);
    expect(isLoopbackWsUrl("https://umai.vercel.app")).toBe(false);
  });

  it("boş/geçersiz girdide false döner", () => {
    expect(isLoopbackWsUrl("")).toBe(false);
    expect(isLoopbackWsUrl(null)).toBe(false);
    expect(isLoopbackWsUrl("localhost:7071")).toBe(false);
    expect(isLoopbackWsUrl("ftp://localhost")).toBe(false);
  });
});

describe("resolveTerminalWsUrl", () => {
  it("admin uzak adresi kullanabilir", () => {
    expect(resolveTerminalWsUrl("wss://oracle.example.com/?token=x", true))
      .toBe("wss://oracle.example.com/?token=x");
  });

  it("admin adres girmezse localhost'a düşer", () => {
    expect(resolveTerminalWsUrl("", true)).toBe(LOCAL_TERMINAL_WS);
    expect(resolveTerminalWsUrl(undefined, true)).toBe(LOCAL_TERMINAL_WS);
  });

  it("admin olmayan kullanıcı uzak adres girse bile localhost kullanır", () => {
    expect(resolveTerminalWsUrl("wss://oracle.example.com/?token=x", false))
      .toBe(LOCAL_TERMINAL_WS);
  });

  it("admin olmayan kullanıcının kendi localhost adresi korunur", () => {
    const own = "ws://127.0.0.1:7777/?token=abc";
    expect(resolveTerminalWsUrl(own, false)).toBe(own);
  });

  it("boşlukları temizler", () => {
    expect(resolveTerminalWsUrl("  ws://localhost:7071  ", false)).toBe("ws://localhost:7071");
  });
});

describe("terminalHostLabel", () => {
  it("host:port döndürür", () => {
    expect(terminalHostLabel("ws://127.0.0.1:7071/?token=x")).toBe("127.0.0.1:7071");
  });

  it("geçersiz adreste varsayılana düşer", () => {
    expect(terminalHostLabel("bozuk")).toBe(LOCAL_TERMINAL_WS);
  });
});
