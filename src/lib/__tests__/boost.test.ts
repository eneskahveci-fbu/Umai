import { describe, expect, it } from "vitest";
import { pickDraftModels, buildBoostInstruction } from "../boost";
import type { ModelProfile } from "../types";

const m = (id: string, provider: string): ModelProfile =>
  ({ id, label: id, provider, baseUrl: "", model: id, apiKey: "" } as unknown as ModelProfile);

describe("pickDraftModels", () => {
  const models = [m("a", "gemini"), m("b", "groq"), m("c", "gemini")];
  it("tek taslak → yalnız aktif model", () => {
    expect(pickDraftModels(models, models[0], 1).map((x) => x.id)).toEqual(["a"]);
  });
  it("iki taslak → aktif + en güçlü (farklıysa)", () => {
    expect(pickDraftModels(models, models[0], 2, models[1]).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("en güçlü aktifle aynıysa farklı sağlayıcıdan seçer", () => {
    expect(pickDraftModels(models, models[0], 2, models[0]).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("tek model varsa ikinci taslak eklenmez", () => {
    expect(pickDraftModels([models[0]], models[0], 2).length).toBe(1);
  });
});

describe("buildBoostInstruction", () => {
  it("taslakları numaralandırır ve gizlilik talimatı içerir", () => {
    const s = buildBoostInstruction(["birinci taslak", "ikinci taslak"]);
    expect(s).toContain("İÇ TASLAK 1");
    expect(s).toContain("İÇ TASLAK 2");
    expect(s).toContain("ASLA bahsetme");
  });
  it("uzun taslakları 5000 karaktere kırpar", () => {
    const s = buildBoostInstruction(["x".repeat(9000)]);
    expect(s.length).toBeLessThan(6000);
  });
});
