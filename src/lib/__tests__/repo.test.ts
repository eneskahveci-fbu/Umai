import { describe, expect, it } from "vitest";
import { parseRepo } from "../github";
import { isGitLabRepo, parseGitLabRepo } from "../gitlab";

describe("parseRepo (GitHub)", () => {
  it("owner/repo ayrıştırır", () => {
    expect(parseRepo("vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("tam URL ve .git ekini temizler", () => {
    expect(parseRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
  });

  it("tek parça girişte null döner", () => {
    expect(parseRepo("justone")).toBeNull();
  });
});

describe("parseGitLabRepo", () => {
  it("derin namespace'i korur (grup/altgrup)", () => {
    expect(parseGitLabRepo("gitlab.com/group/sub/proj")).toEqual({
      namespace: "group/sub",
      repo: "proj",
    });
  });

  it("gitlab.com ve .git eklerini temizler", () => {
    expect(parseGitLabRepo("https://gitlab.com/u/p.git")).toEqual({
      namespace: "u",
      repo: "p",
    });
  });

  it("çıplak gitlab.com/ önekini (protokolsüz) temizler — uygulama repoları bu biçimde saklanır", () => {
    // Regresyon: "gitlab.com/" temizlenmezse namespace 'gitlab.com/...' olur ve
    // API '404 Project Not Found' döner.
    expect(parseGitLabRepo("gitlab.com/eneskahveci.bs/craft-ai-web")).toEqual({
      namespace: "eneskahveci.bs",
      repo: "craft-ai-web",
    });
  });

  it("tek parça girişte null döner", () => {
    expect(parseGitLabRepo("solo")).toBeNull();
  });
});

describe("isGitLabRepo", () => {
  it("gitlab.com içerenleri ve gl: önekini tanır", () => {
    expect(isGitLabRepo("gitlab.com/u/p")).toBe(true);
    expect(isGitLabRepo("gl:u/p")).toBe(true);
  });

  it("GitHub stilini GitLab saymaz", () => {
    expect(isGitLabRepo("owner/repo")).toBe(false);
  });
});
