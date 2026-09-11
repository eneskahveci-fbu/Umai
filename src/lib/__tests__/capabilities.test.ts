import { afterEach, describe, expect, it, vi } from "vitest";
import { detectCapabilities, hasWebGPU, hasWebRTC, hasIndexedDB } from "../capabilities";

afterEach(() => vi.unstubAllGlobals());

describe("capabilities — savunmacı algılama", () => {
  it("node ortamında bile hata atmadan boolean döndürür", () => {
    const c = detectCapabilities();
    for (const v of Object.values(c)) expect(typeof v).toBe("boolean");
  });

  it("navigator.gpu varsa hasWebGPU true, yoksa false", () => {
    vi.stubGlobal("navigator", { gpu: {} });
    expect(hasWebGPU()).toBe(true);
    vi.stubGlobal("navigator", {});
    expect(hasWebGPU()).toBe(false);
  });

  it("RTCPeerConnection tanımlıysa hasWebRTC true", () => {
    vi.stubGlobal("RTCPeerConnection", function RTC() {});
    expect(hasWebRTC()).toBe(true);
  });

  it("hasIndexedDB boolean döndürür", () => {
    expect(typeof hasIndexedDB()).toBe("boolean");
  });
});
