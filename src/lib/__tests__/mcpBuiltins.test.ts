import { describe, expect, it } from "vitest";
import {
  BUILTIN_MCP_SERVERS,
  builtinMcpUrl,
  callBuiltinTool,
  convertTime,
  getCurrentTime,
  isBuiltinMcpPath,
  isBuiltinMcpServerId,
  listBuiltinTools,
} from "../mcpBuiltins";

describe("mcpBuiltins", () => {
  it("isBuiltinMcpServerId yalnızca bilinen id'leri kabul eder", () => {
    for (const id of BUILTIN_MCP_SERVERS) expect(isBuiltinMcpServerId(id)).toBe(true);
    expect(isBuiltinMcpServerId("unknown")).toBe(false);
  });

  it("builtinMcpUrl / isBuiltinMcpPath tutarlı", () => {
    for (const id of BUILTIN_MCP_SERVERS) {
      const url = builtinMcpUrl(id);
      expect(url).toBe(`/api/mcp/builtin/${id}`);
      expect(isBuiltinMcpPath(url)).toBe(true);
    }
    expect(isBuiltinMcpPath("/api/mcp/builtin/unknown")).toBe(false);
    expect(isBuiltinMcpPath("https://evil.test/api/mcp/builtin/time")).toBe(false);
  });

  it("her yerleşik sunucunun en az bir aracı var", () => {
    for (const id of BUILTIN_MCP_SERVERS) {
      const tools = listBuiltinTools(id);
      expect(tools.length).toBeGreaterThan(0);
      for (const t of tools) {
        expect(t.name).toBeTruthy();
        expect(t.description.length).toBeGreaterThan(5);
        expect(t.inputSchema.type).toBe("object");
      }
    }
  });

  it("get_current_time geçerli bir saat dilimi için dolu bir metin döndürür", () => {
    const out = getCurrentTime("Europe/Istanbul");
    expect(out.length).toBeGreaterThan(5);
    expect(out).not.toMatch(/Geçersiz/);
  });

  it("get_current_time geçersiz saat dilimini nazikçe reddeder", () => {
    expect(getCurrentTime("Not/AZone")).toMatch(/Geçersiz saat dilimi/);
  });

  it("convertTime aynı saat dilimi için saati değiştirmez", () => {
    const out = convertTime("Europe/Istanbul", "14:30", "Europe/Istanbul");
    expect(out).toContain("14:30");
  });

  it("convertTime geçersiz saat biçimini reddeder", () => {
    expect(convertTime("Europe/Istanbul", "99:99", "UTC")).toMatch(/Geçersiz saat biçimi/);
    expect(convertTime("Europe/Istanbul", "abc", "UTC")).toMatch(/Geçersiz saat biçimi/);
  });

  it("callBuiltinTool: time araçlarını dispatch eder", () => {
    expect(callBuiltinTool("time", "get_current_time", { timezone: "UTC" })).not.toMatch(/Geçersiz/);
    expect(callBuiltinTool("time", "unknown_tool", {})).toMatch(/Bilinmeyen araç/);
  });

  it("callBuiltinTool: sequential-thinking bir durum özeti döndürür", () => {
    const out = callBuiltinTool("sequential-thinking", "sequentialthinking", {
      thought: "test", thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true,
    });
    const parsed = JSON.parse(out) as { thoughtNumber: number; totalThoughts: number; thoughtLength: number };
    expect(parsed.thoughtNumber).toBe(1);
    expect(parsed.totalThoughts).toBe(3);
    expect(parsed.thoughtLength).toBe(4);
  });

  it("callBuiltinTool: everything echo/add çalışır", () => {
    expect(callBuiltinTool("everything", "echo", { message: "merhaba" })).toBe("merhaba");
    expect(callBuiltinTool("everything", "add", { a: 2, b: 3 })).toBe("5");
  });
});
