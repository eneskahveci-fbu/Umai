import { describe, expect, it } from "vitest";
import { canOutline } from "../outline";

describe("canOutline", () => {
  it("taslak desteklenen dilleri tanır", () => {
    for (const lang of ["typescript", "tsx", "javascript", "python", "go", "rust"]) {
      expect(canOutline(lang)).toBe(true);
    }
  });

  it("desteklenmeyen dillerde false döner", () => {
    for (const lang of ["text", "", "markdown", "sql"]) {
      expect(canOutline(lang)).toBe(false);
    }
  });
});
