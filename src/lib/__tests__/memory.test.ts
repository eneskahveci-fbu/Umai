import { describe, it, expect } from "vitest";
import { bm25Score } from "@/lib/memory";

describe("bm25Score", () => {
  it("tam eşleşme → pozitif puan", () => {
    const dfMap = new Map([["foo", 1]]);
    expect(bm25Score(["foo"], ["foo", "bar"], 2, dfMap, 1)).toBeGreaterThan(0);
  });

  it("eşleşme yok → 0", () => {
    const dfMap = new Map([["xyz", 1]]);
    expect(bm25Score(["foo"], ["bar", "baz"], 2, dfMap, 2)).toBe(0);
  });

  it("boş sorgu → 0", () => {
    const dfMap = new Map([["foo", 1]]);
    expect(bm25Score([], ["foo", "bar"], 2, dfMap, 1)).toBe(0);
  });

  it("boş doküman → 0", () => {
    const dfMap = new Map([["foo", 1]]);
    expect(bm25Score(["foo"], [], 1, dfMap, 1)).toBe(0);
  });

  it("daha yüksek frekans → daha yüksek puan", () => {
    const dfMap = new Map([["foo", 1]]);
    const low = bm25Score(["foo"], ["foo", "bar", "baz"], 3, dfMap, 1);
    const high = bm25Score(["foo"], ["foo", "foo", "bar"], 3, dfMap, 1);
    expect(high).toBeGreaterThan(low);
  });

  it("daha nadir terim (düşük df) → daha yüksek IDF ağırlığı", () => {
    const dfRare = new Map([["foo", 1]]);
    const dfCommon = new Map([["foo", 9]]);
    const rare = bm25Score(["foo"], ["foo", "bar"], 2, dfRare, 10);
    const common = bm25Score(["foo"], ["foo", "bar"], 2, dfCommon, 10);
    expect(rare).toBeGreaterThan(common);
  });
});
