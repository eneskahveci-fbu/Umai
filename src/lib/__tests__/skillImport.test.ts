import { describe, expect, it } from "vitest";
import { deriveSkillTitle } from "../skillImport";

describe("deriveSkillTitle", () => {
  it("markdown başlığını tercih eder", () => {
    expect(deriveSkillTitle("Giriş yazısı\n\n# TypeScript Kuralları\nİçerik…", "https://x/y.md"))
      .toBe("TypeScript Kuralları");
  });
  it("başlık yoksa ilk anlamlı satırı alır ve 60'a kırpar", () => {
    const t = deriveSkillTitle(`${"Çok ".repeat(30)}uzun ilk satır`, "https://x/y.md");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.startsWith("Çok")).toBe(true);
  });
  it("boş içerikte URL dosya adından türetir", () => {
    expect(deriveSkillTitle("", "https://raw.github.com/a/b/main/react-best-practices.md"))
      .toBe("react best practices");
  });
});
