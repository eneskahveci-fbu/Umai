import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepoTree, parseRepo, splitRepoBranch } from "../github";

/* Bug: Ayarlar → Git'teki depo giriş kutusu "sahip/depo VEYA sahip/depo:dal"
   biçimini önerir (placeholder), ama ":dal" kısmı hiçbir yerde
   ayrıştırılmıyordu — kullanıcı önerilen biçimi yazınca parseRepo bunu
   geçersiz sayıyordu ("depo hâlâ bağlanmıyor" raporunun bir parçası). */

describe("splitRepoBranch", () => {
  it("dal soneki yoksa aynen döner", () => {
    expect(splitRepoBranch("owner/repo")).toEqual({ repoStr: "owner/repo", branch: null });
  });

  it("':dal' sonekini ayırır", () => {
    expect(splitRepoBranch("owner/repo:develop")).toEqual({ repoStr: "owner/repo", branch: "develop" });
  });

  it("eğik çizgili dal adlarını da ayırır (ör. feature/x)", () => {
    expect(splitRepoBranch("owner/repo:feature/x")).toEqual({ repoStr: "owner/repo", branch: "feature/x" });
  });

  it("https:// şemasındaki ':'yi dal ayracı SANMAZ", () => {
    expect(splitRepoBranch("https://github.com/owner/repo")).toEqual({
      repoStr: "https://github.com/owner/repo",
      branch: null,
    });
  });

  it("şemalı URL + dal sonekini birlikte doğru ayırır", () => {
    expect(splitRepoBranch("https://gitlab.com/ns/repo:main")).toEqual({
      repoStr: "https://gitlab.com/ns/repo",
      branch: "main",
    });
  });

  it("GitLab 'gl:' önekini dal ayracıyla KARIŞTIRMAZ", () => {
    expect(splitRepoBranch("gl:namespace/repo")).toEqual({ repoStr: "gl:namespace/repo", branch: null });
  });

  it("'gl:' önekiyle birlikte dal sonekini de ayırır", () => {
    expect(splitRepoBranch("gl:namespace/repo:main")).toEqual({ repoStr: "gl:namespace/repo", branch: "main" });
  });

  it("parseRepo, splitRepoBranch'ten geçen repoStr'yi artık kabul eder (önceden ':' yüzünden reddediyordu)", () => {
    const { repoStr } = splitRepoBranch("octocat/Hello-World:gh-pages");
    expect(parseRepo(repoStr)).toEqual({ owner: "octocat", repo: "Hello-World" });
    /* Ham (bölünmemiş) string hâlâ reddedilir — bu da splitRepoBranch'in
       neden ÖNCE çağrılması gerektiğini kanıtlar. */
    expect(parseRepo("octocat/Hello-World:gh-pages")).toBeNull();
  });
});

describe("fetchRepoTree", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("branchOverride verilirse default_branch yerine ONU kullanır ve URL'e kodlar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { branch } = await fetchRepoTree("octocat", "Hello-World", undefined, "feature/x");
    expect(branch).toBe("feature/x");
    const treeUrl = String(fetchMock.mock.calls[1]![0]);
    /* "feature/x" URL'e KODLANMADAN geçilirse yol bambaşka bir kaynağa
       işaret eder ya da 404 döner — bu yüzden %2F bekleniyor. */
    expect(treeUrl).toContain("git/trees/feature%2Fx");
  });

  it("branchOverride verilmezse eski davranış: default_branch kullanılır", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { branch } = await fetchRepoTree("octocat", "Hello-World");
    expect(branch).toBe("main");
  });
});
