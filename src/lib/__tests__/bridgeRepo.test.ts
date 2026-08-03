import { describe, expect, it } from "vitest";
import { buildBridgeSyncCommand, buildCloneUrl, isLikelyLongRunning, shQuote } from "../bridgeRepo";

describe("shQuote", () => {
  it("düz metni tek tırnak içine alır", () => {
    expect(shQuote("craft-coder")).toBe("'craft-coder'");
  });

  it("gömülü tek tırnağı GÜVENLİ kaçırır (kabuk komut enjeksiyonu önlenir)", () => {
    /* `spawn(cmd, {shell:true})` ile çalıştırıldığı için ('; rm -rf /; echo ')
       gibi bir değer kaçış olmadan tırnaklanırsa kabuk komutu enjekte edebilir.
       Bu, güvenlik açısından en kritik test — kaçmazsa gerçek bir açık olur. */
    const evil = "x'; rm -rf /; echo 'y";
    const quoted = shQuote(evil);
    /* POSIX kabuğunda `'\''` deseni: mevcut tek-tırnaklı dizeyi kapat, kaçmış
       bir tek tırnak ekle, tek-tırnaklı dizeyi yeniden aç — standart ve tek
       güvenli yöntem. Aradaki `; rm -rf /; echo ` İÇERİK olarak kalır,
       kabuk onu asla ayrı bir komut olarak yorumlamaz (tek tırnak içindeyken
       ";" özel anlamını kaybeder). */
    expect(quoted).toBe("'x'\\''; rm -rf /; echo '\\''y'");
  });
});

describe("buildCloneUrl", () => {
  it("GitHub: token doğrudan kullanıcı adı olur", () => {
    const url = buildCloneUrl({ provider: "github", token: "ghp_ABC123" }, "eneskahveci-fbu", "Umai");
    expect(url).toBe("https://ghp_ABC123@github.com/eneskahveci-fbu/Umai.git");
  });

  it("GitLab: 'oauth2:' önekiyle döner (GitLab'ın belgelenen PAT kullanımı)", () => {
    const url = buildCloneUrl({ provider: "gitlab", token: "glpat-XYZ789" }, "eneskahveci.bs", "craft-coder");
    expect(url).toBe("https://oauth2:glpat-XYZ789@gitlab.com/eneskahveci.bs/craft-coder.git");
  });

  it("token yoksa (genel depo) düz URL döner, kimlik bilgisi eklenmez", () => {
    const url = buildCloneUrl({ provider: "github" }, "owner", "repo");
    expect(url).toBe("https://github.com/owner/repo.git");
    expect(url).not.toContain("@");
  });

  it("token URL-özel karakter içerse bile geçerli URL üretir", () => {
    const url = buildCloneUrl({ provider: "github", token: "a/b c" }, "o", "r");
    expect(url).toBe("https://a%2Fb%20c@github.com/o/r.git");
  });
});

describe("buildBridgeSyncCommand", () => {
  it("klasör yoksa klonlar, VARSA fetch+hard-reset yapar (tek komutta)", () => {
    const cmd = buildBridgeSyncCommand({
      source: { provider: "gitlab", token: "glpat-abc" },
      owner: "ns", repo: "proj", branch: "main", dir: "proj",
    });
    expect(cmd).toContain("test -d 'proj'/.git");
    expect(cmd).toContain("git clone --branch 'main'");
    expect(cmd).toContain("oauth2:glpat-abc@gitlab.com/ns/proj.git");
    expect(cmd).toContain("git reset --hard 'origin/main'");
  });

  it("dizin/dal adında tek tırnak olsa bile kabuğu bozmaz", () => {
    /* Uç durum: kullanıcı localBridgeDir'i "it's-mine" gibi girerse. */
    const cmd = buildBridgeSyncCommand({
      source: { provider: "github" },
      owner: "o", repo: "r", branch: "main", dir: "it's-mine",
    });
    expect(cmd).toContain("'it'\\''s-mine'");
    expect(cmd).not.toMatch(/[^\\]'s-mine\/\.git/); // kaçışsız tırnak sızıntısı yok
  });

  it("token her seferinde 'remote set-url' ile TAZELENİR (rotasyon sorunsuz)", () => {
    const cmd = buildBridgeSyncCommand({
      source: { provider: "github", token: "ghp_new" },
      owner: "o", repo: "r", branch: "main", dir: "r",
    });
    expect(cmd).toContain("git remote set-url origin");
  });
});

describe("isLikelyLongRunning", () => {
  it("geliştirme sunucusu komutlarını tanır", () => {
    expect(isLikelyLongRunning("npm run dev")).toBe(true);
    expect(isLikelyLongRunning("npm start")).toBe(true);
    expect(isLikelyLongRunning("yarn dev")).toBe(true);
    expect(isLikelyLongRunning("pnpm dev")).toBe(true);
    expect(isLikelyLongRunning("next dev")).toBe(true);
    expect(isLikelyLongRunning("nodemon server.js")).toBe(true);
    expect(isLikelyLongRunning("vite")).toBe(true);
    expect(isLikelyLongRunning("webpack --watch")).toBe(true);
  });

  it("tek seferlik komutları KALICI saymaz", () => {
    expect(isLikelyLongRunning("npm test")).toBe(false);
    expect(isLikelyLongRunning("npm run build")).toBe(false);
    expect(isLikelyLongRunning("vite build")).toBe(false);
    expect(isLikelyLongRunning("git status")).toBe(false);
    expect(isLikelyLongRunning("ls -la")).toBe(false);
    expect(isLikelyLongRunning("npm install")).toBe(false);
  });
});
