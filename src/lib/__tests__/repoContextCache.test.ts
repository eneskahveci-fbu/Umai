import { describe, expect, it, vi } from "vitest";
import { cached, repoCacheKey } from "../repoContextCache";

describe("repoCacheKey", () => {
  it("owner/repo/branch/provider'dan tutarlı bir anahtar kurar", () => {
    const ctx = { provider: "github", owner: "acme", repo: "app", branch: "main" };
    expect(repoCacheKey(ctx, "tree")).toBe("tree:github:acme/app@main");
    expect(repoCacheKey(ctx, "soul")).toBe("soul:github:acme/app@main");
  });

  it("provider belirtilmezse güvenli bir varsayılana düşer (token'a asla dayanmaz)", () => {
    const ctx = { owner: "acme", repo: "app", branch: "main" };
    expect(repoCacheKey(ctx, "pkg")).toBe("pkg:github:acme/app@main");
  });

  it("farklı dal/repo farklı anahtar üretir", () => {
    const a = repoCacheKey({ provider: "gitlab", owner: "x", repo: "y", branch: "main" }, "tree");
    const b = repoCacheKey({ provider: "gitlab", owner: "x", repo: "y", branch: "dev" }, "tree");
    expect(a).not.toBe(b);
  });
});

describe("cached", () => {
  it("aynı anahtarla ikinci çağrıda fn'i TEKRAR ÇAĞIRMAZ (TTL içinde)", async () => {
    const fn = vi.fn().mockResolvedValue("sonuç");
    const key = `test:${Math.random()}`;
    const a = await cached(key, fn);
    const b = await cached(key, fn);
    expect(a).toBe("sonuç");
    expect(b).toBe("sonuç");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("farklı anahtarlar bağımsız önbelleklenir", async () => {
    const fnA = vi.fn().mockResolvedValue("A");
    const fnB = vi.fn().mockResolvedValue("B");
    const keyA = `test-a:${Math.random()}`;
    const keyB = `test-b:${Math.random()}`;
    expect(await cached(keyA, fnA)).toBe("A");
    expect(await cached(keyB, fnB)).toBe("B");
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });

  it("fn hata fırlatırsa SONUÇ önbelleklenmez — bir sonraki çağrı tekrar dener", async () => {
    const key = `test-fail:${Math.random()}`;
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("geçici hata"))
      .mockResolvedValueOnce("nihayet başarılı");
    await expect(cached(key, fn)).rejects.toThrow("geçici hata");
    const result = await cached(key, fn);
    expect(result).toBe("nihayet başarılı");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
