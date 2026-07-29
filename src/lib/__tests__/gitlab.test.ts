import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitLabRepoTree } from "../gitlab";

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
