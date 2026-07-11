import { describe, it, expect } from "vitest";
import { CODER_TOOLS } from "../tools";

describe("CODER_TOOLS", () => {
  it("en az bir araç tanımlıyor", () => {
    expect(CODER_TOOLS.length).toBeGreaterThan(0);
  });

  it("her aracın adı benzersiz", () => {
    const names = CODER_TOOLS.map((t) => t.function.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("her araç adı geçerli bir fonksiyon adı biçiminde (küçük harf + alt çizgi)", () => {
    for (const t of CODER_TOOLS) {
      expect(t.function.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("her aracın açıklaması var", () => {
    for (const t of CODER_TOOLS) {
      expect(t.function.description.length).toBeGreaterThan(0);
    }
  });

  it("her aracın type alanı 'function'", () => {
    for (const t of CODER_TOOLS) {
      expect(t.type).toBe("function");
      expect(t.function.parameters.type).toBe("object");
    }
  });

  it("required listesindeki her alan properties içinde tanımlı (yazım hatası koruması)", () => {
    for (const t of CODER_TOOLS) {
      const propKeys = Object.keys(t.function.parameters.properties);
      for (const req of t.function.parameters.required) {
        expect(propKeys, `${t.function.name}: required '${req}' properties'te yok`).toContain(req);
      }
    }
  });
});
