import { describe, expect, it } from "vitest";
import {
  parseGitignore,
  isIgnored,
  detectFrameworks,
  extractDeps,
} from "../projectContext";

describe("parseGitignore", () => {
  it("yorum ve boş satırları atar", () => {
    const out = parseGitignore("# comment\nnode_modules/\n\n*.log\n  dist/  ");
    expect(out).toEqual(["node_modules/", "*.log", "dist/"]);
  });
});

describe("isIgnored", () => {
  const pats = parseGitignore("node_modules/\n*.log\n/dist\n.env");
  it("dizin desenini eşler", () => {
    expect(isIgnored("node_modules/x/y.js", pats)).toBe(true);
    expect(isIgnored("src/node_modules/a.js", pats)).toBe(true);
  });
  it("uzantı desenini eşler", () => {
    expect(isIgnored("logs/app.log", pats)).toBe(true);
    expect(isIgnored("app.log", pats)).toBe(true);
  });
  it("kök desenini eşler", () => {
    expect(isIgnored("dist/bundle.js", pats)).toBe(true);
  });
  it("birebir dosyayı eşler", () => {
    expect(isIgnored(".env", pats)).toBe(true);
  });
  it("eşleşmeyeni geçer", () => {
    expect(isIgnored("src/index.ts", pats)).toBe(false);
    expect(isIgnored("README.md", pats)).toBe(false);
  });
  it("negasyon (!) desenini güvenle atlar", () => {
    expect(isIgnored("keep.log", ["*.log", "!keep.log"])).toBe(true); // basit: negasyon yok sayılır
  });
});

describe("extractDeps", () => {
  it("deps + devDeps birleştirir", () => {
    const deps = extractDeps(JSON.stringify({ dependencies: { react: "19" }, devDependencies: { vitest: "1" } }));
    expect(deps).toEqual({ react: "19", vitest: "1" });
  });
  it("bozuk JSON'da boş döner", () => {
    expect(extractDeps("{ bozuk")).toEqual({});
  });
});

describe("detectFrameworks", () => {
  it("bağımlılıklardan algılar", () => {
    const fw = detectFrameworks({ deps: { next: "16", react: "19", tailwindcss: "4" } });
    expect(fw).toContain("Next.js");
    expect(fw).toContain("React");
    expect(fw).toContain("Tailwind CSS");
  });
  it("dosya işaretlerinden algılar", () => {
    expect(detectFrameworks({ paths: ["manage.py", "app/models.py"] })).toContain("Django");
    expect(detectFrameworks({ paths: ["Cargo.toml"] })).toContain("Rust (Cargo)");
    expect(detectFrameworks({ paths: ["go.mod"] })).toContain("Go");
  });
  it("hiçbiri yoksa boş döner", () => {
    expect(detectFrameworks({ deps: {}, paths: ["src/x.txt"] })).toEqual([]);
  });
  it("yinelenenleri tekilleştirir", () => {
    const fw = detectFrameworks({ deps: { react: "19" }, paths: ["package.json"] });
    expect(fw.filter((f) => f === "React")).toHaveLength(1);
  });
});
