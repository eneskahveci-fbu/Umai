import { describe, expect, it } from "vitest";
import { migrateRepos, mergeConfigs } from "../store";
import { DEFAULT_CONFIG } from "../constants";
import type { Config, ModelProfile } from "../types";

const model = (id: string, apiKey = ""): ModelProfile => ({
  id,
  label: id,
  provider: "custom",
  baseUrl: "https://example.test",
  model: "m",
  apiKey,
});

const cfg = (over: Partial<Config> = {}): Config => ({ ...DEFAULT_CONFIG, ...over });

const DEAD = "eneskahveci-sdo/craft-ai";
/* Eskiden DEFAULT_CONFIG'e gömülü gelen depo — o proje de artık YOK. */
const DEAD_DEFAULT = "gitlab.com/eneskahveci.bs/craft-ai-web";

describe("migrateRepos", () => {
  /* Davranış DEĞİŞTİ: ölü depo başka bir sabit depoyla değiştirilmiyor, SİLİNİYOR.
     Eski hedef (DEFAULT_REPO) de erişilemez olduğu için kullanıcı hiç seçmediği,
     404 veren bir depoya "bağlı" kalıyordu. */
  it("ölü depoyu listeden siler, yerine başka depo koymaz", () => {
    const out = migrateRepos(cfg({ repos: [DEAD, "a/b"], activeRepo: DEAD }));
    expect(out.repos).toEqual(["a/b"]);
    expect(out.activeRepo).toBe("a/b");
  });

  it("gömülü varsayılan ölü depoyu da temizler", () => {
    const out = migrateRepos(cfg({ repos: [DEAD_DEFAULT], activeRepo: DEAD_DEFAULT }));
    expect(out.repos).toEqual([]);
    expect(out.activeRepo).toBeNull();
  });

  it("ölü repo yoksa aynı nesneyi (referansı) döndürür", () => {
    const c = cfg({ repos: ["a/b"], activeRepo: "a/b" });
    expect(migrateRepos(c)).toBe(c);
  });

  it("aktif depo ölüyse listede kalan ilk depoya düşer", () => {
    const out = migrateRepos(cfg({ repos: ["x/y", DEAD], activeRepo: DEAD }));
    expect(out.activeRepo).toBe("x/y");
  });
});

describe("mergeConfigs — depo silme kalıcılığı", () => {
  it("silinen depo buluttan GERİ GELMEZ (mezar taşı)", () => {
    /* Regresyon: `repos` koşulsuz birleşimle merge ediliyordu, bu yüzden
       kullanıcı bir depoyu silse de sonraki senkronda uzaktan geri geliyordu. */
    const out = mergeConfigs(
      cfg({ repos: ["a/b"], deletedRepos: ["eski/repo"] }),
      { repos: ["eski/repo", "a/b"] },
    );
    expect(out.repos).toEqual(["a/b"]);
  });

  it("mezar taşı uzaktan gelse de yerelde silinmiş sayılır", () => {
    const out = mergeConfigs(
      cfg({ repos: ["a/b", "eski/repo"] }),
      { repos: ["eski/repo"], deletedRepos: ["eski/repo"] },
    );
    expect(out.repos).toEqual(["a/b"]);
  });

  it("silinmemiş depoları iki taraftan da korur", () => {
    const out = mergeConfigs(cfg({ repos: ["a/b"] }), { repos: ["c/d"] });
    expect(out.repos.sort()).toEqual(["a/b", "c/d"]);
  });
});

describe("mergeConfigs", () => {
  it("uzakta anahtarsız aynı model varsa yereldeki anahtarı korur", () => {
    const out = mergeConfigs(
      cfg({ models: [model("m1", "SECRET")], activeModelId: "m1" }),
      { models: [model("m1", "")] },
    );
    expect(out.models.find((m) => m.id === "m1")?.apiKey).toBe("SECRET");
  });

  it("yerelde olup uzakta olmayan modeli kaybetmez", () => {
    const out = mergeConfigs(
      cfg({ models: [model("m1", "K1"), model("m2", "K2")], activeModelId: "m1" }),
      { models: [model("m1", "K1")] },
    );
    expect(out.models.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
  });

  it("uzak token doluysa onu tercih eder", () => {
    const out = mergeConfigs(
      cfg({ githubAccounts: [{ id: "g", username: "u", token: "OLD" }] }),
      { githubAccounts: [{ id: "g", username: "u", token: "NEW" }] },
    );
    expect(out.githubAccounts[0].token).toBe("NEW");
  });

  it("aktif model listede yoksa ilk modele düşer", () => {
    const out = mergeConfigs(
      cfg({ models: [model("m1", "K")], activeModelId: "ghost" }),
      {},
    );
    expect(out.activeModelId).toBe("m1");
  });

  it("birleşmede uzaktaki ölü repo geri gelse de temizlenir", () => {
    const out = mergeConfigs(cfg({ repos: ["a/b"] }), { repos: [DEAD] });
    expect(out.repos).not.toContain(DEAD);
    expect(out.repos).toContain("a/b");
  });

  it("silme mezar taşı: yerelde silinmiş bir model uzaktaki bayat kopyadan geri gelmez", () => {
    const out = mergeConfigs(
      cfg({ models: [], deletedIds: ["m1"] }),
      { models: [model("m1", "OLD_STILL_HERE")] },
    );
    expect(out.models.find((m) => m.id === "m1")).toBeUndefined();
  });

  it("silme mezar taşı: uzakta silinmiş bir skill yereldeki bayat kopyadan geri gelmez", () => {
    const skill = { id: "s1", title: "t", content: "c", tags: [], enabled: true, source: "manual" as const, usageCount: 0, createdAt: 0 };
    const out = mergeConfigs(
      cfg({ skills: [skill] }),
      { skills: [], deletedIds: ["s1"] },
    );
    expect(out.skills?.find((s) => s.id === "s1")).toBeUndefined();
  });

  it("silme mezar taşı iki taraftan birleşir (base.deletedIds)", () => {
    const out = mergeConfigs(cfg({ deletedIds: ["a"] }), { deletedIds: ["b"] });
    expect(out.deletedIds).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("apiKey zaman damgası: BİLEREK temizlenen (updatedAt daha yeni) anahtar uzaktaki bayat kopyadan geri gelmez", () => {
    const out = mergeConfigs(
      cfg({ models: [{ ...model("m1", ""), updatedAt: 2000 }], activeModelId: "m1" }),
      { models: [{ ...model("m1", "STALE_KEY"), updatedAt: 1000 }] },
    );
    expect(out.models.find((m) => m.id === "m1")?.apiKey).toBe("");
  });

  it("apiKey zaman damgası: uzaktaki DAHA YENİ anahtar yereldeki eskiyi ezer", () => {
    const out = mergeConfigs(
      cfg({ models: [{ ...model("m1", "OLD"), updatedAt: 1000 }], activeModelId: "m1" }),
      { models: [{ ...model("m1", "NEW"), updatedAt: 2000 }] },
    );
    expect(out.models.find((m) => m.id === "m1")?.apiKey).toBe("NEW");
  });

  it("apiKey zaman damgası yoksa (eski veri) geriye dönük uyum: dolu anahtar kazanır", () => {
    const out = mergeConfigs(
      cfg({ models: [model("m1", "")], activeModelId: "m1" }),
      { models: [model("m1", "NO_TIMESTAMP")] },
    );
    expect(out.models.find((m) => m.id === "m1")?.apiKey).toBe("NO_TIMESTAMP");
  });
});
