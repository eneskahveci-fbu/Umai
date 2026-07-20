import { describe, it, expect } from "vitest";
import { applyIssue, MAX_PROOF_ISSUES, validateIssues } from "../proofread";

const segs = ["Bu bir yanlız örnek metindir.", "İkinci parça herşey iyi."];

describe("validateIssues", () => {
  it("geçerli önerileri kabul eder, kind düşerse yazim'a çevirir", () => {
    const out = validateIssues({ issues: [
      { b: 0, find: "yanlız", replace: "yalnız", reason: "yazım", kind: "yazim" },
      { b: 1, find: "herşey", replace: "her şey", reason: "ayrı yazılır", kind: "acayip" },
    ] }, segs);
    expect(out.length).toBe(2);
    expect(out[1].kind).toBe("yazim");
  });

  it("uydurma find / aralık dışı b / değişiklik içermeyen öneri / kopya elenir", () => {
    const out = validateIssues({ issues: [
      { b: 0, find: "metinde yok", replace: "x", kind: "yazim" },
      { b: 9, find: "yanlız", replace: "yalnız", kind: "yazim" },
      { b: 0, find: "yanlız", replace: "yanlız", kind: "yazim" },
      { b: 0, find: "yanlız", replace: "yalnız", kind: "yazim" },
      { b: 0, find: "yanlız", replace: "yalnız", kind: "yazim" },
    ] }, segs);
    expect(out.length).toBe(1);
  });

  it("segmentte BİRDEN FAZLA geçen belirsiz find reddedilir (yanlış geçişi düzeltme riski)", () => {
    const ambiguous = ["kedi köpek ile kedi oynadı."];
    const out = validateIssues({ issues: [
      { b: 0, find: "kedi", replace: "kuş", kind: "yazim" }, // "kedi" 2 kez geçiyor — belirsiz
      { b: 0, find: "köpek ile", replace: "köpekle", kind: "yazim" }, // tek geçiş — kabul
    ] }, ambiguous);
    expect(out).toHaveLength(1);
    expect(out[0].find).toBe("köpek ile");
  });

  it("bozuk kök / issues dizisi olmayan girdi boş döner; üst sınır uygulanır", () => {
    expect(validateIssues("çöp", segs)).toEqual([]);
    expect(validateIssues({ issues: "dizi değil" }, segs)).toEqual([]);
    const many = { issues: Array.from({ length: 50 }, (_, i) => ({ b: 0, find: "Bu", replace: `x${i}`, kind: "yazim" })) };
    /* aynı b+find kopya sayılır → 1 kalır (tekilleştirme üst sınırdan önce). */
    expect(validateIssues(many, segs).length).toBe(1);
    const distinct = { issues: Array.from({ length: 50 }, (_, i) => ({ b: 0, find: "Bu bir yanlız örnek metindir.".slice(0, 5 + (i % 20)), replace: "Q", kind: "yazim" })) };
    expect(validateIssues(distinct, segs).length).toBeLessThanOrEqual(MAX_PROOF_ISSUES);
  });
});

describe("applyIssue", () => {
  it("yalnız ilk geçtiği yeri değiştirir", () => {
    expect(applyIssue("aba aba", { find: "aba", replace: "X" })).toBe("X aba");
  });
  it("find yoksa null döner (metin değişmiş)", () => {
    expect(applyIssue("temiz metin", { find: "yok", replace: "X" })).toBeNull();
  });
});
