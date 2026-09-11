import { describe, it, expect } from "vitest";
import { buildChangelogEntry, buildReadmePrompt, type CommitInfo } from "@/lib/autoDoc";

describe("buildChangelogEntry", () => {
  const commits: CommitInfo[] = [
    { hash: "abc1234567", message: "feat(ajan): yeni özellik ekle" },
    { hash: "def4567890", message: "fix: kritik hatayı düzelt" },
    { hash: "ghi7890123", message: "— serbest metin, konvansiyon yok" },
  ];

  it("commit'leri türe göre gruplar", () => {
    const out = buildChangelogEntry(commits, "1.2.0", "2026-01-01");
    expect(out).toContain("## [1.2.0] — 2026-01-01");
    expect(out).toContain("### Yeni Özellikler");
    expect(out).toContain("### Hata Düzeltmeleri");
    expect(out).toContain("yeni özellik ekle");
  });

  it("scope'u kalın olarak ekler", () => {
    const out = buildChangelogEntry(commits, "1.2.0", "2026-01-01");
    expect(out).toContain("**ajan**:");
  });

  it("kısa hash'i (7 karakter) gösterir", () => {
    const out = buildChangelogEntry(commits, "1.2.0", "2026-01-01");
    expect(out).toContain("`abc1234`");
  });

  it("konvansiyonel olmayan mesajları 'Diğer Değişiklikler'e koyar", () => {
    const out = buildChangelogEntry(commits, "1.2.0", "2026-01-01");
    expect(out).toContain("### Diğer Değişiklikler");
    expect(out).toContain("serbest metin, konvansiyon yok");
  });

  it("tarih verilmezse bugünün tarihini (YYYY-MM-DD) kullanır", () => {
    const out = buildChangelogEntry([{ hash: "a", message: "feat: x" }]);
    expect(out).toMatch(/## \[Sonraki Sürüm\] — \d{4}-\d{2}-\d{2}/);
  });

  it("boş commit listesinde başlık satırını yine de üretir", () => {
    const out = buildChangelogEntry([], "1.0.0", "2026-01-01");
    expect(out).toBe("## [1.0.0] — 2026-01-01\n");
  });
});

describe("buildReadmePrompt", () => {
  it("repo adını, değişiklikleri ve mevcut README'yi içerir", () => {
    const prompt = buildReadmePrompt("umai", "# umai\n\neski içerik", "yeni özellik X eklendi");
    expect(prompt).toContain("**Repo:** umai");
    expect(prompt).toContain("yeni özellik X eklendi");
    expect(prompt).toContain("eski içerik");
  });

  it("çok uzun README'yi 4000 karakterde kırpar", () => {
    const long = "x".repeat(5000);
    const prompt = buildReadmePrompt("umai", long, "değişiklik");
    expect(prompt).toContain("…(kırpıldı)");
    expect(prompt.length).toBeLessThan(long.length + 1000);
  });
});
