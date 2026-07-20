import { describe, expect, it } from "vitest";
import { migrateRepos, mergeConfigs } from "../store";
import { DEFAULT_CONFIG, DEFAULT_REPO } from "../constants";
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

describe("migrateRepos", () => {
  it("ölü GitHub deposunu DEFAULT_REPO ile değiştirir (liste + aktif)", () => {
    const out = migrateRepos(cfg({ repos: [DEAD, "a/b"], activeRepo: DEAD }));
    expect(out.repos).toContain(DEFAULT_REPO);
    expect(out.repos).not.toContain(DEAD);
    expect(out.activeRepo).toBe(DEFAULT_REPO);
  });

  it("ölü repo yoksa aynı nesneyi (referansı) döndürür", () => {
    const c = cfg({ repos: ["a/b"], activeRepo: "a/b" });
    expect(migrateRepos(c)).toBe(c);
  });

  it("migrasyon sonrası tekrarlı repoları ayıklar", () => {
    const out = migrateRepos(cfg({ repos: [DEAD, DEFAULT_REPO] }));
    expect(out.repos.filter((r) => r === DEFAULT_REPO)).toHaveLength(1);
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

  it("birleşmede uzaktaki ölü repo geri gelse de migrate edilir", () => {
    const out = mergeConfigs(cfg({ repos: [DEFAULT_REPO] }), { repos: [DEAD] });
    expect(out.repos).not.toContain(DEAD);
    expect(out.repos).toContain(DEFAULT_REPO);
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
