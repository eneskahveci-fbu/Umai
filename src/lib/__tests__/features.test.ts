import { describe, expect, it } from "vitest";
import { FEATURES, isStudioPathEnabled, studioEnabled, type Features } from "@/lib/features";
import { ALL_AGENTS } from "@/lib/agents";

const all: Features = { designStudio: true, contentTools: true, media: true };
const none: Features = { designStudio: false, contentTools: false, media: false };

describe("isStudioPathEnabled", () => {
  it("içerik araçları yollarını contentTools'a bağlar", () => {
    for (const p of ["/studio/araclar", "/studio/araclar?tab=anket", "/studio/dokuman", "/studio/anket", "/studio/defter", "/studio/kroki", "/studio/kartlar"]) {
      expect(isStudioPathEnabled(p, { ...none, contentTools: true })).toBe(true);
      expect(isStudioPathEnabled(p, { ...all, contentTools: false })).toBe(false);
    }
  });
  it("tasarım yollarını designStudio'ya bağlar", () => {
    for (const p of ["/studio", "/studio/", "/studio/sunum", "/studio/tuval"]) {
      expect(isStudioPathEnabled(p, { ...none, designStudio: true })).toBe(true);
      expect(isStudioPathEnabled(p, { ...all, designStudio: false })).toBe(false);
    }
  });
});

describe("studioEnabled", () => {
  it("biri açıksa Stüdyo girişi görünür", () => {
    expect(studioEnabled(none)).toBe(false);
    expect(studioEnabled({ ...none, contentTools: true })).toBe(true);
    expect(studioEnabled({ ...none, designStudio: true })).toBe(true);
  });
});

describe("medya anahtarı", () => {
  it("/gorsel yalnız medya açıkken komut listesinde", () => {
    expect(ALL_AGENTS.some((a) => a.id === "image-gen")).toBe(FEATURES.media);
  });
});
