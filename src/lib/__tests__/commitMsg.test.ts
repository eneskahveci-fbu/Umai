import { describe, expect, it } from "vitest";
import { buildUnifiedDiff, cleanCommitMessage } from "../commitMsg";

describe("buildUnifiedDiff", () => {
  it("ekleme ve silmeleri +/- ile işaretler", () => {
    const d = buildUnifiedDiff("a.ts", "satır bir\nsatır iki\n", "satır bir\nsatır üç\n");
    expect(d).toContain("--- a.ts");
    expect(d).toContain("- satır iki");
    expect(d).toContain("+ satır üç");
    expect(d).not.toContain("satır bir\n+"); // bağlam satırı dahil edilmez
  });
  it("değişiklik yoksa bunu söyler", () => {
    expect(buildUnifiedDiff("a.ts", "aynı\n", "aynı\n")).toContain("(değişiklik yok)");
  });
  it("maxChars aşılınca kırpar", () => {
    const oldT = "";
    const newT = Array.from({ length: 300 }, (_, i) => `yeni satır ${i} ${"x".repeat(50)}`).join("\n");
    const d = buildUnifiedDiff("a.ts", oldT, newT, 1000);
    expect(d).toContain("… (kırpıldı)");
    expect(d.length).toBeLessThan(1400);
  });
});

describe("cleanCommitMessage", () => {
  it("kod çitini ve öneki soyar", () => {
    expect(cleanCommitMessage("```\nfeat: yeni özellik\n```")).toBe("feat: yeni özellik");
    expect(cleanCommitMessage("Commit mesajı: fix: hata giderildi")).toBe("fix: hata giderildi");
  });
  it("çevreleyen tırnakları soyar", () => {
    expect(cleanCommitMessage('"chore: bağımlılık güncelle"')).toBe("chore: bağımlılık güncelle");
  });
  it("ilk satırı 72 karaktere kırpar, gövdeye dokunmaz", () => {
    const long = "feat: " + "ç".repeat(100) + "\n\n- madde bir";
    const out = cleanCommitMessage(long);
    expect(out.split("\n")[0].length).toBeLessThanOrEqual(72);
    expect(out).toContain("- madde bir");
  });
});
