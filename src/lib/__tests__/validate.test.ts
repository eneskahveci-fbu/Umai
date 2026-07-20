import { describe, expect, it } from "vitest";
import { asOwner, asRepo, asBranch, asRepoPath, timingSafeEqualStr, ValidationError } from "../validate";

describe("validate helpers", () => {
  it("asOwner accepts normal GitHub usernames", () => {
    expect(asOwner("octocat")).toBe("octocat");
    expect(asOwner("a-valid-user-99")).toBe("a-valid-user-99");
  });
  it("asOwner rejects bad input", () => {
    expect(() => asOwner("")).toThrow(ValidationError);
    expect(() => asOwner("with spaces")).toThrow(ValidationError);
    expect(() => asOwner(123 as unknown)).toThrow(ValidationError);
  });

  it("asRepo blocks . and ..", () => {
    expect(() => asRepo(".")).toThrow(ValidationError);
    expect(() => asRepo("..")).toThrow(ValidationError);
  });

  it("asBranch accepts slashes", () => {
    expect(asBranch("feat/x")).toBe("feat/x");
    expect(asBranch("main")).toBe("main");
  });

  it("asRepoPath blocks path traversal", () => {
    expect(() => asRepoPath("../etc/passwd")).toThrow(ValidationError);
    expect(() => asRepoPath("/abs/path")).toThrow(ValidationError);
    expect(asRepoPath("src/lib/foo.ts")).toBe("src/lib/foo.ts");
  });

  describe("timingSafeEqualStr", () => {
    it("eşit stringlerde true döner", () => {
      expect(timingSafeEqualStr("Bearer abc123", "Bearer abc123")).toBe(true);
    });
    it("farklı stringlerde (aynı uzunluk) false döner", () => {
      expect(timingSafeEqualStr("Bearer abc123", "Bearer xyz789")).toBe(false);
    });
    it("farklı uzunlukta false döner (timingSafeEqual atmadan)", () => {
      expect(timingSafeEqualStr("kısa", "çok-daha-uzun-bir-string")).toBe(false);
      expect(timingSafeEqualStr("", "x")).toBe(false);
    });
  });
});
