import { describe, expect, it } from "vitest";
import { fuzzyFiles } from "../fuzzy";

const files = [
  { name: "route.ts", path: "src/app/api/route.ts" },
  { name: "store.ts", path: "src/lib/store.ts" },
  { name: "CoderView.tsx", path: "src/components/CoderView.tsx" },
];

describe("fuzzyFiles", () => {
  it("boş sorguda listeyi olduğu gibi döndürür", () => {
    expect(fuzzyFiles(files, "")).toEqual(files);
    expect(fuzzyFiles(files, "   ")).toEqual(files);
  });

  it("bitişik olmayan harf dizisini bulur (apprt → api/route)", () => {
    const hits = fuzzyFiles(files, "apprt");
    expect(hits[0].path).toBe("src/app/api/route.ts");
  });

  it("tam alt-dize ile en alakalıyı öne alır", () => {
    const hits = fuzzyFiles(files, "store");
    expect(hits[0].path).toBe("src/lib/store.ts");
  });

  it("alakasız sorguda sonuç döndürmez", () => {
    expect(fuzzyFiles(files, "zzzqqq")).toHaveLength(0);
  });
});
