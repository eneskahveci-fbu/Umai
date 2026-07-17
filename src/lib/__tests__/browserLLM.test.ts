import { describe, expect, it } from "vitest";
import {
  BROWSER_MODEL_ID,
  browserLLMHasWebGPU,
  browserLLMSupported,
  getBrowserLLMLoadProgress,
  isBrowserLLMLoaded,
  runBrowserLLM,
} from "../browserLLM";

/* Testler `environment: node` altında çalışır (window/navigator yok) — bu
   yüzden yalnız ortam-korumalı fonksiyonların Node'da güvenli şekilde
   "desteklenmiyor" döndüğünü doğrularız. Gerçek transformers.js/WebGPU
   akışı yalnız tarayıcıda çalışır (bkz. CoderView.tsx'in "browser" dalı). */

describe("browserLLMSupported", () => {
  it("Node ortamında (window yok) false döner", () => {
    expect(browserLLMSupported()).toBe(false);
  });
});

describe("browserLLMHasWebGPU", () => {
  it("navigator yokken false döner", () => {
    expect(browserLLMHasWebGPU()).toBe(false);
  });
});

describe("getBrowserLLMLoadProgress", () => {
  it("henüz yükleme başlamadıysa 0 döner", () => {
    expect(getBrowserLLMLoadProgress()).toBe(0);
  });
});

describe("isBrowserLLMLoaded", () => {
  it("henüz hiç çağrılmadıysa false döner", () => {
    expect(isBrowserLLMLoaded()).toBe(false);
  });
});

describe("runBrowserLLM", () => {
  it("desteklenmeyen (Node) ortamda null döner, patlamaz", async () => {
    const onDelta = () => {};
    await expect(runBrowserLLM([{ role: "user", content: "selam" }], onDelta)).resolves.toBeNull();
  });
});

describe("BROWSER_MODEL_ID", () => {
  it("geçerli bir onnx-community transformers.js modeli işaret eder", () => {
    expect(BROWSER_MODEL_ID).toMatch(/^onnx-community\//);
  });
});
