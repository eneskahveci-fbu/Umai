import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitLabRepoTree, resolveRepoProvider } from "../gitlab";

describe("fetchGitLabRepoTree", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("branchOverride verilirse default_branch yerine ONU kullanır", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { branch } = await fetchGitLabRepoTree("ns", "repo", undefined, "develop");
    expect(branch).toBe("develop");
    const treeUrl = String(fetchMock.mock.calls[1]![0]);
    expect(treeUrl).toContain("ref=develop");
  });

  it("branchOverride verilmezse eski davranış: default_branch (yoksa 'main')", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "master" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { branch } = await fetchGitLabRepoTree("ns", "repo");
    expect(branch).toBe("master");
  });
});

describe("resolveRepoProvider", () => {
  it("bağlantıyı kuran tarafın yazdığı provider'ı metne TERCİH eder", () => {
    /* Asıl regresyon: "namespace/repo" GitHub'da bulunamayıp GitLab'a
       düşünce metin hâlâ öneksizdir; metne bakılırsa GitHub sanılır, ajana
       GitHub token'ı gider ve her araç çağrısı 404 alır. */
    expect(resolveRepoProvider({ provider: "gitlab" }, "eneskahveci.bs/craft-coder")).toBe("gitlab");
    expect(resolveRepoProvider({ provider: "github" }, "gitlab.com/ns/repo")).toBe("github");
  });

  it("provider yoksa (eski kalıcı kayıt) metin sezgisine düşer", () => {
    expect(resolveRepoProvider({}, "gitlab.com/ns/repo")).toBe("gitlab");
    expect(resolveRepoProvider({}, "gl:ns/repo")).toBe("gitlab");
    expect(resolveRepoProvider({}, "owner/repo")).toBe("github");
  });

  it("repo henüz bağlanmamışken (null/undefined) metne bakar", () => {
    expect(resolveRepoProvider(null, "gitlab.com/ns/repo")).toBe("gitlab");
    expect(resolveRepoProvider(undefined, "owner/repo")).toBe("github");
    expect(resolveRepoProvider(null, "")).toBe("github");
  });
});
