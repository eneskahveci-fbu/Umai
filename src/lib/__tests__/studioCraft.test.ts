import { describe, expect, it } from "vitest";
import { lintArtifact } from "../studioCraft";

describe("lintArtifact", () => {
  it("temiz artifact → boş liste", () => {
    const html = `<html><head><meta name="viewport" content="width=device-width"><style>:root{--bg:#111110;--accent:#c8a87e}</style></head><body>Merhaba</body></html>`;
    expect(lintArtifact(html)).toEqual([]);
  });
  it("indigo klişesini yakalar", () => {
    expect(lintArtifact("<style>a{color:#6366f1}</style>").join(" ")).toContain("indigo");
  });
  it("aşırı ham renk sayısını yakalar", () => {
    const colors = Array.from({ length: 20 }, (_, i) => `#${(i + 1).toString(16).padStart(2, "0")}22aa`).join(";color:");
    expect(lintArtifact(`<style>a{color:${colors}}</style>`).join(" ")).toContain("ham renk");
  });
  it("lorem ipsum ve viewport eksiğini yakalar", () => {
    const w = lintArtifact("<html><body>Lorem ipsum dolor</body></html>").join(" ");
    expect(w).toContain("Lorem ipsum");
    expect(w).toContain("viewport");
  });
});
