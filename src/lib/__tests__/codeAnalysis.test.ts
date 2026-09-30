import { describe, it, expect } from "vitest";
import {
  cyclomaticComplexity,
  missingJsdoc,
  generateJsdocPrompt,
  detectDuplicates,
} from "@/lib/codeAnalysis";

describe("cyclomaticComplexity", () => {
  it("basit fonksiyon → skor 1, iyi", () => {
    const code = `function hello() { return 42; }`;
    const r = cyclomaticComplexity(code);
    expect(r.score).toBe(1);
    expect(r.rating).toBe("iyi");
  });

  it("birkaç karar noktası → orta", () => {
    const code = `
      function foo(a, b, c) {
        if (a) { return 1; }
        if (b && c) { return 2; }
        return a || b ? 3 : 4;
      }
    `;
    const r = cyclomaticComplexity(code);
    expect(r.score).toBeGreaterThan(5);
    expect(["orta", "karmaşık"]).toContain(r.rating);
  });

  it("çok karmaşık → karmaşık", () => {
    const code = Array(12).fill("if (x) {}").join("\n");
    expect(cyclomaticComplexity(code).rating).toBe("karmaşık");
  });

  it("boş kod → skor 1", () => {
    expect(cyclomaticComplexity("").score).toBe(1);
  });
});

describe("missingJsdoc", () => {
  it("JSDoc olan export → eksik listede yok", () => {
    const code = `
/** Merhaba der. */
export function hello() {}
    `;
    expect(missingJsdoc(code)).not.toContain("hello");
  });

  it("JSDoc olmayan export → eksik listede", () => {
    const code = `
export function world() {}
    `;
    expect(missingJsdoc(code)).toContain("world");
  });

  it("export olmayan fonksiyon → kontrol edilmez", () => {
    const code = `function internal() {}`;
    expect(missingJsdoc(code)).toHaveLength(0);
  });

  it("const export JSDoc eksik → eksik listede", () => {
    const code = `export const helper = (x: number) => x * 2;`;
    expect(missingJsdoc(code)).toContain("helper");
  });
});

describe("generateJsdocPrompt", () => {
  it("fonksiyon imzasını içerir", () => {
    const prompt = generateJsdocPrompt("function foo(a: number): string");
    expect(prompt).toContain("function foo");
    expect(prompt).toContain("JSDoc");
  });
});

describe("detectDuplicates", () => {
  it("tekrarsız kod → boş", () => {
    const code = `const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;`;
    expect(detectDuplicates(code)).toHaveLength(0);
  });

  it("tekrar eden blok → tespit edilir", () => {
    const block = `const x = foo();\nconst y = bar();\nconst z = baz();\nconst w = qux();\nreturn x + y;`;
    const code = `${block}\n// ----\n${block}`;
    const dups = detectDuplicates(code);
    expect(dups.length).toBeGreaterThan(0);
    expect(dups[0].occurrences).toBeGreaterThanOrEqual(2);
  });
});
