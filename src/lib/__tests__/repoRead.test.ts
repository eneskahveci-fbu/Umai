import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("yalnızca okuma araçları içerir (search_code dahil — J2: alt-ajanlar artık grep yapabilir)", () => {
    expect(READONLY_TOOL_NAMES.has("read_file")).toBe(true);
    expect(READONLY_TOOL_NAMES.has("list_files")).toBe(true);
    expect(READONLY_TOOL_NAMES.has("search_code")).toBe(true);
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

describe("executeReadTool — search_code (J2: alt-ajan içerik araması)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("boş query'de ağa hiç çıkmadan hata döner", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { owner: "o", repo: "r", branch: "main", provider: "github" as const };
    expect(await executeReadTool("search_code", { query: "" }, ctx)).toContain("query boş");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("github: /search/code sonuçlarındaki dosya yollarını döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ path: "src/lib/foo.ts" }, { path: "src/lib/bar.ts" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { owner: "o", repo: "r", branch: "main", provider: "github" as const };
    const out = await executeReadTool("search_code", { query: "detectModelCapabilities" }, ctx);
    expect(out).toBe("src/lib/foo.ts\nsrc/lib/bar.ts");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("api.github.com/search/code");
  });

  it("github: eşleşme yoksa bunu açıkça söyler", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { owner: "o", repo: "r", branch: "main", provider: "github" as const };
    expect(await executeReadTool("search_code", { query: "yok-boyle-bir-sey" }, ctx)).toBe("(eşleşme yok)");
  });

  it("gitlab: search API'sinden path:satır + kod parçacığı döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { path: "src/x.ts", data: "const foo = 1;", startline: 12 },
    ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { owner: "o", repo: "r", branch: "main", provider: "gitlab" as const };
    const out = await executeReadTool("search_code", { query: "foo" }, ctx);
    expect(out).toContain("src/x.ts:12");
    expect(out).toContain("const foo = 1;");
  });

  it("yerel köprü: /fs/grep'e delege eder, regex özel karakterlerini kaçırır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ matches: ["a.ts:3: foo(bar)"] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { owner: "o", repo: "r", branch: "main", provider: "local" as const, bridgeUrl: "http://localhost:4000", bridgeToken: "t" };
    const out = await executeReadTool("search_code", { query: "foo(bar)", extension: "ts" }, ctx);
    expect(out).toBe("a.ts:3: foo(bar)");
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { pattern: string; glob: string };
    expect(sentBody.pattern).toBe("foo\\(bar\\)");
    expect(sentBody.glob).toBe("**/*.ts");
  });
});

describe("executeReadTool — list_files GitLab sayfalaması", () => {
  afterEach(() => vi.unstubAllGlobals());

  /* GitLab ağacı sayfa başına en çok 100 kayıt döner ve gerisini
     `x-next-page` ile bildirir. Sayfalama yokken ajan GitLab depolarında
     yalnız ilk 100 dosyayı görüyor, var olan dosyaları "yok" sanıyordu. */
  const page = (paths: string[], next: string | null) =>
    new Response(JSON.stringify(paths.map((p) => ({ path: p, type: "blob" }))), {
      status: 200,
      headers: next ? { "x-next-page": next } : {},
    });

  it("x-next-page varken sonraki sayfaları da çeker", async () => {
    const first = Array.from({ length: 100 }, (_, i) => `src/a${i}.ts`);
    const second = ["src/zz-son-dosya.ts"];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(page(first, "2"))
      .mockResolvedValueOnce(page(second, null));
    vi.stubGlobal("fetch", fetchMock);

    const out = await executeReadTool("list_files", {}, { owner: "ns", repo: "r", branch: "main", provider: "gitlab" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("page=2");
    /* Sayfalama öncesi bu dosya listede HİÇ görünmüyordu. */
    expect(out).toContain("src/zz-son-dosya.ts");
    expect(out.split("\n")).toHaveLength(101);
  });

  it("x-next-page yoksa tek sayfada durur (gereksiz istek yok)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(page(["a.ts", "b.ts"], null));
    vi.stubGlobal("fetch", fetchMock);

    const out = await executeReadTool("list_files", {}, { owner: "ns", repo: "r", branch: "main", provider: "gitlab" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out).toBe("a.ts\nb.ts");
  });

  it("x-next-page ilerlemiyorsa döngüye girmez", async () => {
    /* Bozuk/yinelenen başlık sonsuz döngü yapmamalı. */
    const fetchMock = vi.fn().mockResolvedValue(page(["a.ts"], "1"));
    vi.stubGlobal("fetch", fetchMock);

    await executeReadTool("list_files", {}, { owner: "ns", repo: "r", branch: "main", provider: "gitlab" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
