import { describe, expect, it } from "vitest";
import { hasUnsavedWork, hasUnsavedItem, recentProjects, relativeTime } from "../studioProjectState";

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

describe("relativeTime", () => {
  const NOW = 1_800_000_000_000;
  const min = 60_000, hr = 60 * min, day = 24 * hr;

  it("bir dakikadan yeniyse 'az önce'", () => {
    expect(relativeTime(NOW, NOW)).toBe("az önce");
    expect(relativeTime(NOW - 20_000, NOW)).toBe("az önce");
  });

  it("dakika / saat / gün eşiklerini doğru geçer", () => {
    expect(relativeTime(NOW - 3 * min, NOW)).toBe("3 dk önce");
    expect(relativeTime(NOW - 59 * min, NOW)).toBe("59 dk önce");
    expect(relativeTime(NOW - 2 * hr, NOW)).toBe("2 sa önce");
    expect(relativeTime(NOW - 3 * day, NOW)).toBe("3 gün önce");
  });

  it("saf: aynı girdiyle her zaman aynı çıktı (render'da Date.now yok)", () => {
    expect(relativeTime(NOW - 5 * min, NOW)).toBe(relativeTime(NOW - 5 * min, NOW));
  });
});

describe("hasUnsavedItem — çıktı-tipi bağımsız kural (5 yüzey)", () => {
  it("ortada öğe yoksa kayıp yok", () => {
    expect(hasUnsavedItem(null, [])).toBe(false);
    expect(hasUnsavedItem(undefined, [{ id: "a" }])).toBe(false);
  });

  it("hiç kaydedilmemiş öğe kaydedilmemiş sayılır", () => {
    expect(hasUnsavedItem({ id: "a" }, [])).toBe(true);
    expect(hasUnsavedItem({ id: "a" }, [{ id: "b" }])).toBe(true);
  });

  it("kaydedildikten sonra değişmişse kaydedilmemiş sayılır", () => {
    expect(hasUnsavedItem({ id: "a", updatedAt: 200 }, [{ id: "a", updatedAt: 100 }])).toBe(true);
    expect(hasUnsavedItem({ id: "a", updatedAt: 100 }, [{ id: "a", updatedAt: 100 }])).toBe(false);
  });

  it("hasUnsavedWork ile aynı kuralı paylaşır (html varken)", () => {
    const saved = [{ id: "a", updatedAt: 100 }];
    expect(hasUnsavedWork({ id: "a", html: "<p/>", updatedAt: 200 }, saved))
      .toBe(hasUnsavedItem({ id: "a", updatedAt: 200 }, saved));
  });
});
