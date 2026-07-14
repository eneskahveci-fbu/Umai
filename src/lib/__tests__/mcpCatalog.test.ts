import { describe, expect, it } from "vitest";
import { MCP_CATALOG } from "../mcpCatalog";

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
});
