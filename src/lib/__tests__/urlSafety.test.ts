import { describe, it, expect } from "vitest";
import { isSafeRemoteUrl } from "../urlSafety";

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
