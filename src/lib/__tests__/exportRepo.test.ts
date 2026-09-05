import { describe, expect, it } from "vitest";
import { filesForArtifact, repoSlug } from "../exportRepo";
import type { Artifact } from "../types";

describe("repoSlug", () => {
  it("Türkçe karakterleri ve boşlukları GitHub'ın kabul edeceği ada çevirir", () => {
    expect(repoSlug("Kahve Dükkânı Sitesi")).toBe("kahve-dukkani-sitesi");
    expect(repoSlug("Işık & Gölge")).toBe("isik-golge");
  });

  it("uçlardaki tireleri ve tekrarları temizler", () => {
    expect(repoSlug("  --Todo   App--  ")).toBe("todo-app");
  });

  it("boş/anlamsız başlıkta yedeğe düşer", () => {
    expect(repoSlug("")).toBe("umai-app");
    expect(repoSlug("!!!")).toBe("umai-app");
    expect(repoSlug(undefined, "x")).toBe("x");
  });

  it("uzunluğu sınırlar ve sonda tire bırakmaz", () => {
    const s = repoSlug("a".repeat(30) + " " + "b".repeat(40));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });

  it("yalnız [a-z0-9-] içerir — validate.ts asRepo bunu kesin kabul eder", () => {
    for (const t of ["Çok Güzel Bir Uygulama", "v2.0 (beta)", "hello_world"]) {
      expect(repoSlug(t)).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("filesForArtifact", () => {
  const html: Artifact = { type: "html", content: "<h1>Merhaba</h1>", title: "Deneme" };

  it("html artifact'ı tek dosyalık index.html + README'ye çevirir", () => {
    const files = filesForArtifact(html);
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(["index.html", "README.md"]);
    expect(files[0].content).toContain("<h1>Merhaba</h1>");
  });

  it("svg için hem index.html hem ham image.svg yazar", () => {
    const files = filesForArtifact({ type: "svg", content: "<svg/>", title: "Logo" });
    expect(files.map((f) => f.path)).toEqual(["index.html", "image.svg", "README.md"]);
  });

  it("kod artifact'ında uzantıyı dilden türetir", () => {
    const files = filesForArtifact({ type: "code", content: "print(1)", title: "x", language: "python" });
    expect(files[0].path).toBe("main.py");
    const unknown = filesForArtifact({ type: "code", content: "?", title: "x", language: "brainfuck" });
    expect(unknown[0].path).toBe("main.txt");
  });

  it("README paylaşım imzasını ve başlığı taşır (prompt.md Hamle 3)", () => {
    const readme = filesForArtifact(html, "https://umai.app").find((f) => f.path === "README.md")!;
    expect(readme.content).toContain("# Deneme");
    expect(readme.content).toContain("https://umai.app");
    expect(readme.content).toContain("UMAI");
  });

  it("dosya yolları batch-write'ın asRepoPath'ini geçer: göreli, '..' yok", () => {
    for (const f of filesForArtifact(html)) {
      expect(f.path.startsWith("/")).toBe(false);
      expect(f.path.includes("..")).toBe(false);
    }
  });
});
