import { describe, expect, it } from "vitest";
import { hasUnsavedWork, hasUnsavedItem, recentProjects, relativeTime, contentSignature } from "../studioProjectState";

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

  /* Not: kayıtlı kopya artık projenin html'ini de TAŞIMALI. Gerçekte zaten
     öyle (StudioProject.html zorunlu alan); fixture'lar içerik karşılaştırması
     eklendikten sonra buna uyacak şekilde güncellendi. */
  it("kayıtlı kopya güncelse kaydedilmemiş iş yoktur", () => {
    expect(hasUnsavedWork(
      { id: "a", html: "<div/>", updatedAt: 100 },
      [{ id: "a", html: "<div/>", updatedAt: 100 }],
    )).toBe(false);
    /* Kayıt sonrası hiç dokunulmadıysa kayıt daha yeni de olabilir. */
    expect(hasUnsavedWork(
      { id: "a", html: "<div/>", updatedAt: 100 },
      [{ id: "a", html: "<div/>", updatedAt: 150 }],
    )).toBe(false);
  });

  it("zaman damgası eksik olsa da çökmeden makul davranır", () => {
    /* Kayıtta damga yok, projede var → değişmiş say (veri kaybetmemek yönünde hata yap). */
    expect(hasUnsavedWork({ id: "a", html: "<div/>", updatedAt: 5 }, [{ id: "a", html: "<div/>" }])).toBe(true);
    /* İkisinde de damga yok VE içerik aynı → eşit say. */
    expect(hasUnsavedWork({ id: "a", html: "<div/>" }, [{ id: "a", html: "<div/>" }])).toBe(false);
  });

  /* Asıl kazanç: damga eşit olsa bile ÇIKTI değiştiyse uyarı çıkar. */
  it("damga aynı ama html değişmişse kaydedilmemiş sayılır", () => {
    expect(hasUnsavedWork(
      { id: "a", html: "<div>YENİ</div>", updatedAt: 100 },
      [{ id: "a", html: "<div/>", updatedAt: 100 }],
    )).toBe(true);
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

/* GERÇEK HATA (Tem 2026 denetimi): hiçbir yüzey düzenleme sırasında updatedAt
   damgasını vurmuyor (damga yalnız kaydetmede vuruluyor) — bu yüzden KAYITLI
   bir öğeyi baştan sona değiştirip "+ Yeni"ye basınca iki damga eşit kalıyor,
   onay çıkmıyor ve düzenleme sessizce siliniyordu. */
describe("hasUnsavedItem — damga DEĞİŞMESE bile içerik farkı yakalanır (P0 veri kaybı)", () => {
  it("kayıtlı öğenin içeriği değişmişse, updatedAt AYNI olsa da kaydedilmemiş sayılır", () => {
    const savedDoc = { id: "d1", updatedAt: 100, title: "Rapor", blocks: [{ id: "b1", text: "eski" }] };
    const edited = { id: "d1", updatedAt: 100, title: "Rapor", blocks: [{ id: "b1", text: "YENİ METİN" }] };
    expect(hasUnsavedItem(edited, [savedDoc])).toBe(true);
  });

  it("kaydettikten hemen sonra (birebir aynı içerik) kaydedilmemiş SAYILMAZ", () => {
    const doc = { id: "d1", updatedAt: 100, title: "Rapor", blocks: [{ id: "b1", text: "aynı" }] };
    expect(hasUnsavedItem({ ...doc }, [doc])).toBe(false);
  });

  it("anahtar sırası değişse bile fark sayılmaz (imza sıralı)", () => {
    const saved = { id: "d1", updatedAt: 100, title: "A", kind: "doc" };
    const reordered = { kind: "doc", title: "A", id: "d1", updatedAt: 100 };
    expect(hasUnsavedItem(reordered, [saved])).toBe(false);
  });

  /* FormsStudio `required: e.target.checked || undefined` yazıyor: oturum
     içinde anahtar VAR (undefined), localStorage'dan dönünce anahtar YOK.
     Naif derin karşılaştırma bunu fark sanıp her "+ Yeni"de boşuna sorardı. */
  it("undefined değerli anahtar, hiç olmayan anahtarla eşdeğer sayılır", () => {
    const fromStorage = { id: "f1", updatedAt: 100, questions: [{ id: "q1", label: "S" }] };
    const inSession = { id: "f1", updatedAt: 100, questions: [{ id: "q1", label: "S", required: undefined }] };
    expect(hasUnsavedItem(inSession, [fromStorage])).toBe(false);
  });

  it("iç içe dizi öğesi eklenince yakalanır", () => {
    const saved = { id: "m1", updatedAt: 100, root: { id: "r", children: [{ id: "c1", children: [] }] } };
    const edited = { id: "m1", updatedAt: 100, root: { id: "r", children: [{ id: "c1", children: [] }, { id: "c2", children: [] }] } };
    expect(hasUnsavedItem(edited, [saved])).toBe(true);
  });

  it("createdAt/updatedAt farkı TEK BAŞINA içerik farkı sayılmaz", () => {
    const saved = { id: "d1", updatedAt: 100, createdAt: 1, title: "A" };
    const sameContent = { id: "d1", updatedAt: 100, createdAt: 999, title: "A" };
    expect(hasUnsavedItem(sameContent, [saved])).toBe(false);
  });
});

describe("contentSignature", () => {
  it("anahtar sırasından bağımsızdır (özyinelemeli)", () => {
    expect(contentSignature({ b: 1, a: { d: 2, c: 3 } })).toBe(contentSignature({ a: { c: 3, d: 2 }, b: 1 }));
  });
  it("undefined değerleri düşürür (JSON semantiği)", () => {
    expect(contentSignature({ a: 1, b: undefined })).toBe(contentSignature({ a: 1 }));
  });
  it("zaman damgalarını yok sayar ama yalnız EN ÜST seviyede", () => {
    expect(contentSignature({ id: "x", updatedAt: 1 })).toBe(contentSignature({ id: "x", updatedAt: 2 }));
    expect(contentSignature({ id: "x", nested: { updatedAt: 1 } }))
      .not.toBe(contentSignature({ id: "x", nested: { updatedAt: 2 } }));
  });
  it("dizi sırası anlamlıdır", () => {
    expect(contentSignature({ a: [1, 2] })).not.toBe(contentSignature({ a: [2, 1] }));
  });
});
