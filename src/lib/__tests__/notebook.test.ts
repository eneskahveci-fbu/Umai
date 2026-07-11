import { describe, it, expect } from "vitest";
import { ipynbToReadable, isNotebook, setCellSource } from "../notebook";

const sampleNb = {
  metadata: { kernelspec: { language: "python", name: "python3" } },
  cells: [
    { cell_type: "markdown", source: ["# Başlık\n", "açıklama"] },
    {
      cell_type: "code",
      source: "print('merhaba')",
      outputs: [{ output_type: "stream", text: "merhaba\n" }],
    },
    {
      cell_type: "code",
      source: "1/0",
      outputs: [{ output_type: "error", ename: "ZeroDivisionError", evalue: "division by zero" }],
    },
  ],
};

describe("isNotebook", () => {
  it(".ipynb uzantısını tanır (büyük/küçük harf duyarsız)", () => {
    expect(isNotebook("a/b.ipynb")).toBe(true);
    expect(isNotebook("a/b.IPYNB")).toBe(true);
    expect(isNotebook("a/b.py")).toBe(false);
  });
});

describe("ipynbToReadable", () => {
  it("hücreleri sırayla, tipiyle birlikte metne çevirir", () => {
    const out = ipynbToReadable(JSON.stringify(sampleNb));
    expect(out).toContain("3 hücre");
    expect(out).toContain("çekirdek: python");
    expect(out).toContain("markdown");
    expect(out).toContain("# Başlık");
    expect(out).toContain("print('merhaba')");
  });

  it("stream çıktısını hücrenin altına ekler", () => {
    const out = ipynbToReadable(JSON.stringify(sampleNb));
    expect(out).toContain("Çıktı:");
    expect(out).toContain("merhaba");
  });

  it("hata çıktısını ename/evalue ile gösterir", () => {
    const out = ipynbToReadable(JSON.stringify(sampleNb));
    expect(out).toContain("ZeroDivisionError: division by zero");
  });

  it("geçersiz JSON'da hata mesajı döner (fırlatmaz)", () => {
    expect(ipynbToReadable("{ bozuk json")).toContain("Hata");
  });

  it("boş/cells'siz notebook'ta çökmez", () => {
    expect(ipynbToReadable("{}")).toContain("0 hücre");
  });
});

describe("setCellSource", () => {
  it("belirtilen hücrenin kaynağını günceller ve satır-dizisi biçimine çevirir", () => {
    const out = setCellSource(JSON.stringify(sampleNb), 1, "a\nb");
    const nb = JSON.parse(out);
    expect(nb.cells[1].source).toEqual(["a\n", "b"]);
  });

  it("kod hücresinin eski çıktısını temizler", () => {
    const out = setCellSource(JSON.stringify(sampleNb), 1, "yeni kod");
    const nb = JSON.parse(out);
    expect(nb.cells[1].outputs).toEqual([]);
  });

  it("markdown hücrenin outputs alanına dokunmaz", () => {
    const out = setCellSource(JSON.stringify(sampleNb), 0, "yeni başlık");
    const nb = JSON.parse(out);
    expect(nb.cells[0].outputs).toBeUndefined();
  });

  it("geçersiz hücre indeksinde hata fırlatır", () => {
    expect(() => setCellSource(JSON.stringify(sampleNb), 99, "x")).toThrow();
    expect(() => setCellSource(JSON.stringify(sampleNb), -1, "x")).toThrow();
  });
});
