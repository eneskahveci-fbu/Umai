import { describe, it, expect } from "vitest";
import { looksDangling, waitStage } from "../replyHealth";

describe("looksDangling", () => {
  it("iki noktayla biten kısa giriş yarım sayılır", () => {
    expect(looksDangling("Planı oluşturuyorum ve adım adım ilerliyorum:")).toBe(true);
    expect(looksDangling("  Başlıyorum:\n")).toBe(true);
  });
  it("tam yanıtlar yarım sayılmaz", () => {
    expect(looksDangling("Tamamlandı.")).toBe(false);
    expect(looksDangling("")).toBe(false);
    expect(looksDangling("Örnek:\n```js\nconsole.log(1)\n```")).toBe(false);
    expect(looksDangling("a".repeat(500) + ":")).toBe(false);
  });
});

describe("waitStage", () => {
  it("süreye göre aşama değişir", () => {
    expect(waitStage(1, false).label).toBe("Yanıt hazırlanıyor");
    expect(waitStage(1, true).label).toBe("Düşünüyor");
    expect(waitStage(5, false).label).toBe("Model çalışıyor");
    expect(waitStage(15, false).slow).toBe(false);
    expect(waitStage(40, false).slow).toBe(true);
  });
});
