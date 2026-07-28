import { describe, expect, it } from "vitest";
import { asOwner, asRepo, asBranch, asRepoPath, asGitlabToken, asToken, timingSafeEqualStr, ValidationError } from "../validate";

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

describe("Git token doğrulaması", () => {
  it("GitLab: hem PAT hem OAuth erişim anahtarını kabul eder", () => {
    /* OAuth ile bağlanan hesabın anahtarında glpat- öneki YOKTUR; önek şartı
       yüzünden bu kullanıcılarda her yazma/dal/MR isteği reddediliyordu. */
    const pat = "glpat-abcdefghij1234567890";
    const oauth = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
    expect(asGitlabToken(pat)).toBe(pat);
    expect(asGitlabToken(oauth)).toBe(oauth);
  });

  it("GitLab: başlık enjeksiyonuna açık karakterleri hâlâ reddeder", () => {
    expect(() => asGitlabToken("abc def ghij1234567890")).toThrow(ValidationError);
    expect(() => asGitlabToken("tok\r\nX-Injected: 1234567890abc")).toThrow(ValidationError);
    expect(() => asGitlabToken("kisa")).toThrow(ValidationError);
  });

  it("GitHub: gho_/ghp_ ve klasik 40-hex kabul, çöp reddedilir", () => {
    const gho = "gho_" + "a".repeat(36);
    expect(asToken(gho)).toBe(gho);
    expect(() => asToken("enc:1:abc:def")).toThrow(ValidationError);
  });
});
