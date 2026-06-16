import { describe, it, expect } from "vitest";
import { isPro } from "../plan";

describe("plan gating", () => {
  it("isPro yalnızca 'pro' için true", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("free")).toBe(false);
    expect(isPro(undefined)).toBe(false);
    expect(isPro(null)).toBe(false);
    expect(isPro("")).toBe(false);
  });
});
