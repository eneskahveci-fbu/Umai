import { describe, expect, it } from "vitest";
import { extractAllFileFences, extractFirstFileFence } from "../parsers";

describe("extractAllFileFences", () => {
  it("returns [] for plain prose", () => {
    expect(extractAllFileFences("hello world")).toEqual([]);
  });

  it("parses `lang:path` form", () => {
    const md = "```ts:src/foo.ts\nexport const x = 1\n```";
    const files = extractAllFileFences(md);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/foo.ts");
    expect(files[0].content).toBe("export const x = 1");
  });

  it("parses `lang file=path` form", () => {
    const md = '```ts file=src/bar.ts\nconst y = 2\n```';
    const files = extractAllFileFences(md);
    expect(files[0].path).toBe("src/bar.ts");
  });

  it('parses `lang title="path"` form', () => {
    const md = '```ts title="src/baz.ts"\nconst z = 3\n```';
    const files = extractAllFileFences(md);
    expect(files[0].path).toBe("src/baz.ts");
  });

  it("captures multiple fences in order, dedup'd by path (last wins)", () => {
    const md = [
      "```ts:a/x.ts\nconst v1 = 1\n```",
      "```ts:b/y.ts\nconst v2 = 2\n```",
      "```ts:a/x.ts\nconst v1b = 11\n```",
    ].join("\n\nprose\n\n");
    const files = extractAllFileFences(md);
    expect(files.map((f) => f.path).sort()).toEqual(["a/x.ts", "b/y.ts"]);
    expect(files.find((f) => f.path === "a/x.ts")!.content).toBe("const v1b = 11");
  });

  it("ignores fences without a path-like value", () => {
    const md = "```ts\nconst inline = true\n```";
    expect(extractAllFileFences(md)).toEqual([]);
  });

  it("tolerates an unterminated last fence", () => {
    const md = "```ts:src/eof.ts\nconst tail = 1\n";
    const files = extractAllFileFences(md);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/eof.ts");
    expect(files[0].content).toContain("tail");
  });

  it("extractFirstFileFence returns first match or null", () => {
    expect(extractFirstFileFence("nope")).toBeNull();
    const md = "```ts:a.ts\n1\n```\n```ts:b.ts\n2\n```";
    expect(extractFirstFileFence(md)?.path).toBe("a.ts");
  });
});
