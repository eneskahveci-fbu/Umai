import { describe, it, expect } from "vitest";
import { isSafeRemoteUrl, safeFetch } from "../urlSafety";

/* Sahte fetch: verilen URL→yanıt haritasıyla yönlendirme zinciri simüle eder. */
function fakeFetch(map: Record<string, { status: number; location?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = String(input);
    const r = map[u];
    if (!r) throw new Error(`beklenmeyen istek: ${u}`);
    return new Response("ok", { status: r.status, headers: r.location ? { location: r.location } : {} });
  }) as typeof fetch;
}

describe("safeFetch (yönlendirme SSRF koruması)", () => {
  it("düz 200 yanıtı geçer", async () => {
    const res = await safeFetch("https://example.com/a", undefined, {
      fetchImpl: fakeFetch({ "https://example.com/a": { status: 200 } }),
    });
    expect(res.status).toBe(200);
  });
  it("public→public yönlendirmeyi izler", async () => {
    const res = await safeFetch("https://example.com/a", undefined, {
      fetchImpl: fakeFetch({
        "https://example.com/a": { status: 302, location: "https://cdn.example.com/b" },
        "https://cdn.example.com/b": { status: 200 },
      }),
    });
    expect(res.status).toBe(200);
  });
  it("iç ağa yönlendirmeyi REDDEDER (metadata SSRF)", async () => {
    await expect(
      safeFetch("https://example.com/a", undefined, {
        fetchImpl: fakeFetch({
          "https://example.com/a": { status: 302, location: "http://169.254.169.254/latest/meta-data/" },
        }),
      }),
    ).rejects.toThrow(/Güvensiz/);
  });
  it("hop limitini aşınca hata atar", async () => {
    await expect(
      safeFetch("https://example.com/1", undefined, {
        maxHops: 2,
        fetchImpl: fakeFetch({
          "https://example.com/1": { status: 302, location: "https://example.com/2" },
          "https://example.com/2": { status: 302, location: "https://example.com/3" },
          "https://example.com/3": { status: 302, location: "https://example.com/4" },
          "https://example.com/4": { status: 302, location: "https://example.com/5" },
        }),
      }),
    ).rejects.toThrow(/yönlendirme/);
  });
});

describe("isSafeRemoteUrl", () => {
  it("güvenli genel adresleri kabul eder", () => {
    expect(isSafeRemoteUrl("https://example.com")).toBe(true);
    expect(isSafeRemoteUrl("http://gitlab.com/x/y")).toBe(true);
    expect(isSafeRemoteUrl("https://8.8.8.8/path")).toBe(true);
  });

  it("loopback ve localhost'u reddeder", () => {
    expect(isSafeRemoteUrl("http://localhost:7071")).toBe(false);
    expect(isSafeRemoteUrl("http://127.0.0.1")).toBe(false);
    expect(isSafeRemoteUrl("http://[::1]/")).toBe(false);
    expect(isSafeRemoteUrl("http://foo.localhost")).toBe(false);
  });

  it("özel/dahili IPv4 aralıklarını reddeder", () => {
    expect(isSafeRemoteUrl("http://10.0.0.55")).toBe(false);
    expect(isSafeRemoteUrl("http://192.168.1.1")).toBe(false);
    expect(isSafeRemoteUrl("http://172.16.0.1")).toBe(false);
    expect(isSafeRemoteUrl("http://172.31.255.255")).toBe(false);
    expect(isSafeRemoteUrl("http://100.64.0.1")).toBe(false);
  });

  it("bulut metadata adresini reddeder", () => {
    expect(isSafeRemoteUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("IPv4-mapped IPv6 iç adresi reddeder", () => {
    expect(isSafeRemoteUrl("http://[::ffff:10.0.0.1]/")).toBe(false);
  });

  it("http(s) dışı protokolleri ve geçersiz URL'leri reddeder", () => {
    expect(isSafeRemoteUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeRemoteUrl("ftp://example.com")).toBe(false);
    expect(isSafeRemoteUrl("gopher://x")).toBe(false);
    expect(isSafeRemoteUrl("not a url")).toBe(false);
  });

  it(".local / .internal alanlarını reddeder", () => {
    expect(isSafeRemoteUrl("http://printer.local")).toBe(false);
    expect(isSafeRemoteUrl("http://db.internal")).toBe(false);
  });
});
