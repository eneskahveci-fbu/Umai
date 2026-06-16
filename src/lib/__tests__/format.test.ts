import { describe, expect, it } from "vitest";
import { canFormat } from "../format";

describe("canFormat", () => {
  it("desteklenen dilleri tanır", () => {
    for (const lang of ["typescript", "javascript", "tsx", "json", "css", "html", "markdown", "yaml"]) {
      expect(canFormat(lang)).toBe(true);
    }
  });

  it("desteklenmeyen dillerde false döner", () => {
    for (const lang of ["python", "go", "rust", "", "text"]) {
      expect(canFormat(lang)).toBe(false);
    }
  });
});
