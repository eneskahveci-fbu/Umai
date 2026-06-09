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
});
