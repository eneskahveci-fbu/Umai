import { describe, expect, it } from "vitest";
import { withLineNumbers, READONLY_TOOL_NAMES, executeReadTool } from "../repoRead";

describe("withLineNumbers", () => {
  it("1'den başlayan satır numarası ekler", () => {
    expect(withLineNumbers("a\nb\nc")).toBe("1\ta\n2\tb\n3\tc");
  });
  it("tek satırı numaralar", () => {
    expect(withLineNumbers("tek")).toBe("1\ttek");
  });
  it("boş içeriği bozmaz", () => {
    expect(withLineNumbers("")).toBe("1\t");
  });
});

describe("READONLY_TOOL_NAMES", () => {
  it("yalnızca okuma araçları içerir", () => {
    expect(READONLY_TOOL_NAMES.has("read_file")).toBe(true);
    expect(READONLY_TOOL_NAMES.has("list_files")).toBe(true);
    expect(READONLY_TOOL_NAMES.has("write_file")).toBe(false);
    expect(READONLY_TOOL_NAMES.has("delete_file")).toBe(false);
  });
});

describe("executeReadTool", () => {
  const ctx = { owner: "o", repo: "r", branch: "main" };
  it("yazma/bilinmeyen aracı reddeder (ağ çağrısı yapmadan)", async () => {
    expect(await executeReadTool("write_file", { path: "x", content: "y" }, ctx)).toContain("yalnızca okuma");
    expect(await executeReadTool("delete_file", { path: "x" }, ctx)).toContain("yalnızca okuma");
    expect(await executeReadTool("rastgele", {}, ctx)).toContain("yalnızca okuma");
  });
});
