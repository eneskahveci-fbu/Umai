import { describe, expect, it } from "vitest";
import { MCP_CATALOG } from "../mcpCatalog";
import { isBuiltinMcpServerId } from "../mcpBuiltins";

describe("MCP_CATALOG", () => {
  it("her girdinin id/ad/ikon/açıklaması var", () => {
    for (const e of MCP_CATALOG) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.icon).toBeTruthy();
      expect(e.description.length).toBeGreaterThan(5);
    }
  });

  it("girdi id'leri benzersiz", () => {
    const ids = MCP_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hiçbir açıklama veya ad varsayılan bir sunucu URL'si içermiyor (yalnızca kullanıcı kendi adresini girmeli)", () => {
    for (const e of MCP_CATALOG) {
      expect(e.name).not.toMatch(/https?:\/\//);
      expect(e.description).not.toMatch(/https?:\/\//);
    }
  });

  it("builtinUrl doluysa yalnızca göreli, bilinen bir /api/mcp/builtin/ yoluna işaret eder (dış host'a asla değil)", () => {
    for (const e of MCP_CATALOG) {
      if (!e.builtinUrl) continue;
      expect(e.builtinUrl).not.toMatch(/^https?:\/\//);
      expect(e.builtinUrl.startsWith("/api/mcp/builtin/")).toBe(true);
      expect(isBuiltinMcpServerId(e.builtinUrl.slice("/api/mcp/builtin/".length))).toBe(true);
    }
  });
});
