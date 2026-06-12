import { describe, expect, it } from "vitest";
import { matchGlob, filterByGlob } from "../glob";

describe("matchGlob", () => {
  it("** her dizin derinliğinde eşleşir", () => {
    expect(matchGlob("src/a/b.tsx", "**/*.tsx")).toBe(true);
    expect(matchGlob("x.tsx", "**/*.tsx")).toBe(true);
    expect(matchGlob("src/a/b.ts", "**/*.tsx")).toBe(false);
  });
  it("* tek segment içinde eşleşir, / geçmez", () => {
    expect(matchGlob("src/a.ts", "src/*.ts")).toBe(true);
    expect(matchGlob("src/a/b.ts", "src/*.ts")).toBe(false);
  });
  it("kök seviyesi *.md", () => {
    expect(matchGlob("README.md", "*.md")).toBe(true);
    expect(matchGlob("docs/x.md", "*.md")).toBe(false);
  });
  it("ara dizinli desen src/**/*.ts", () => {
    expect(matchGlob("src/a/b.ts", "src/**/*.ts")).toBe(true);
    expect(matchGlob("src/b.ts", "src/**/*.ts")).toBe(true);
    expect(matchGlob("lib/b.ts", "src/**/*.ts")).toBe(false);
  });
  it("? tek karakter", () => {
    expect(matchGlob("a.ts", "?.ts")).toBe(true);
    expect(matchGlob("ab.ts", "?.ts")).toBe(false);
  });
  it("nokta literal kaçırılır", () => {
    expect(matchGlob("file.ts", "file.ts")).toBe(true);
    expect(matchGlob("fileXts", "file.ts")).toBe(false);
  });
});

describe("filterByGlob", () => {
  it("listeden eşleşenleri döndürür", () => {
    const paths = ["src/a.tsx", "src/b.ts", "src/x/c.tsx", "README.md"];
    expect(filterByGlob(paths, "**/*.tsx")).toEqual(["src/a.tsx", "src/x/c.tsx"]);
  });
});
