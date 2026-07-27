import { describe, expect, it } from "vitest";
import { hasUnsavedWork, recentProjects } from "../studioProjectState";

/* U2/U3 — "+ Yeni" kaydedilmemiş bir tasarımı sessizce siliyordu ve galeriye
   dönmenin yıkıcı olmayan bir yolu yoktu. */

describe("hasUnsavedWork", () => {
  it("henüz çıktı üretilmemişse kaybedilecek bir şey yoktur", () => {
    expect(hasUnsavedWork({ id: "a" }, [])).toBe(false);
    expect(hasUnsavedWork({ id: "a", html: "" }, [])).toBe(false);
  });

  it("hiç kaydedilmemiş bir tasarım kaydedilmemiş sayılır", () => {
    expect(hasUnsavedWork({ id: "a", html: "<div/>" }, [])).toBe(true);
    expect(hasUnsavedWork({ id: "a", html: "<div/>" }, [{ id: "baska" }])).toBe(true);
  });

  it("kaydedildikten SONRA değişmişse kaydedilmemiş sayılır", () => {
    expect(hasUnsavedWork(
      { id: "a", html: "<div/>", updatedAt: 200 },
      [{ id: "a", updatedAt: 100 }],
    )).toBe(true);
  });

  it("kayıtlı kopya güncelse kaydedilmemiş iş yoktur", () => {
    expect(hasUnsavedWork(
      { id: "a", html: "<div/>", updatedAt: 100 },
      [{ id: "a", updatedAt: 100 }],
    )).toBe(false);
    /* Kayıt sonrası hiç dokunulmadıysa kayıt daha yeni de olabilir. */
    expect(hasUnsavedWork(
      { id: "a", html: "<div/>", updatedAt: 100 },
      [{ id: "a", updatedAt: 150 }],
    )).toBe(false);
  });

  it("zaman damgası eksik olsa da çökmeden makul davranır", () => {
    /* Kayıtta damga yok, projede var → değişmiş say (veri kaybetmemek yönünde hata yap). */
    expect(hasUnsavedWork({ id: "a", html: "<div/>", updatedAt: 5 }, [{ id: "a" }])).toBe(true);
    /* İkisinde de yok → eşit say. */
    expect(hasUnsavedWork({ id: "a", html: "<div/>" }, [{ id: "a" }])).toBe(false);
  });
});

describe("recentProjects", () => {
  const list = [
    { id: "eski", updatedAt: 100 },
    { id: "yeni", updatedAt: 300 },
    { id: "orta", updatedAt: 200 },
  ];

  it("en son güncellenen başta olacak şekilde sıralar", () => {
    expect(recentProjects(list).map((p) => p.id)).toEqual(["yeni", "orta", "eski"]);
  });

  it("limiti uygular", () => {
    expect(recentProjects(list, 2).map((p) => p.id)).toEqual(["yeni", "orta"]);
    expect(recentProjects(list, 0)).toEqual([]);
  });

  it("kaynağı değiştirmez (sort yerinde çalışmaz)", () => {
    const copy = [...list];
    recentProjects(list);
    expect(list).toEqual(copy);
  });

  it("boş listede boş döner", () => {
    expect(recentProjects([])).toEqual([]);
  });
});
