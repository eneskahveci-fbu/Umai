import { describe, expect, it } from "vitest";
import { deriveSkillTitle, skillFromText, parseSkillIntent } from "../skillImport";

describe("deriveSkillTitle", () => {
  it("markdown başlığını tercih eder", () => {
    expect(deriveSkillTitle("Giriş yazısı\n\n# TypeScript Kuralları\nİçerik…", "https://x/y.md"))
      .toBe("TypeScript Kuralları");
  });
  it("başlık yoksa ilk anlamlı satırı alır ve 60'a kırpar", () => {
    const t = deriveSkillTitle(`${"Çok ".repeat(30)}uzun ilk satır`, "https://x/y.md");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.startsWith("Çok")).toBe(true);
  });
  it("boş içerikte URL dosya adından türetir", () => {
    expect(deriveSkillTitle("", "https://raw.github.com/a/b/main/react-best-practices.md"))
      .toBe("react best practices");
  });
});

/* Ö4/Ö10 — `skillFromText`, `importSkillFromUrl`ın içinden çıkarıldı: aynı
   dönüşüm artık sohbetten ve sunucu (workspace) dosyalarından da gerekiyor.
   Tek kaynak olduğu için üç yol da aynı davranır. */
describe("skillFromText — ham metinden skill kaydı (Ö4/Ö10)", () => {
  it("SKILL.md ise başlık frontmatter'daki name'den gelir", () => {
    const md = ["---", "name: PDF Ustası", "description: PDF işleri", "---", "", "1. adım", "2. adım"].join("\n");
    const s = skillFromText(md, "notes/pdf.md");
    expect(s.title).toBe("PDF Ustası");
    expect(s.content).toContain("PDF işleri");
    expect(s.content).toContain("1. adım");
    expect(s.tags).toContain("open-design");
  });

  it("düz metinde başlık içerikten türetilir (deriveSkillTitle ile aynı)", () => {
    const s = skillFromText("# Kod İnceleme Rehberi\n\nAdımlar…", "workspace/rehber.md");
    expect(s.title).toBe("Kod İnceleme Rehberi");
    expect(s.tags).toContain("içe-aktarılan");
    expect(s.tags).not.toContain("open-design");
  });

  it("kaynak etiketi fileName'e yazılır ve ek etiketler korunur", () => {
    const s = skillFromText("içerik", "workspace/a.txt", ["sunucu"]);
    expect(s.fileName).toBe("workspace/a.txt");
    expect(s.tags).toContain("sunucu");
    expect(s.enabled).toBe(true);
    expect(s.source).toBe("file");
  });
});

/* Ö4 — sohbetten skill kaydetme niyeti. Önceki regex URL'nin TÜM mesaj
   olmasını şart koşuyordu (`^skill indir <url>$`), bu yüzden cümle içinde
   geçen URL'ler ve "bunu skill olarak kaydet" gibi doğal ifadeler LLM'e
   gidiyor, hiçbir şey kaydedilmiyordu. */
describe("parseSkillIntent (Ö4)", () => {
  it("klasik komutu tanır", () => {
    expect(parseSkillIntent("skill indir https://raw.githubusercontent.com/a/b/SKILL.md"))
      .toEqual({ kind: "import", url: "https://raw.githubusercontent.com/a/b/SKILL.md" });
  });

  it("URL cümlenin İÇİNDE geçse de tanır", () => {
    expect(parseSkillIntent("şunu skill olarak ekler misin: https://x.dev/SKILL.md teşekkürler"))
      .toEqual({ kind: "import", url: "https://x.dev/SKILL.md" });
  });

  it("URL sonundaki noktalama temizlenir", () => {
    expect(parseSkillIntent("bu skill'i indir: https://x.dev/a.md."))
      .toEqual({ kind: "import", url: "https://x.dev/a.md" });
  });

  it("'bunu skill olarak kaydet' son yanıtı hedefler", () => {
    expect(parseSkillIntent("bunu skill olarak kaydet")).toEqual({ kind: "saveLast" });
    expect(parseSkillIntent("yukarıdaki cevabı skill olarak ekle")).toEqual({ kind: "saveLast" });
  });

  it("skill sözcüğü geçmeyen normal istekleri YAKALAMAZ", () => {
    expect(parseSkillIntent("şu dosyayı indir https://x.dev/a.zip")).toBeNull();
    expect(parseSkillIntent("bunu kaydet")).toBeNull();
  });

  it("neyin kaydedileceği belirsizse normal akışa bırakır", () => {
    /* "skill ekle" tek başına hangi içeriği kastettiğini söylemiyor. */
    expect(parseSkillIntent("skill ekle")).toBeNull();
  });

  it("uzun metinleri komut sanmaz (skill İÇERİĞİNİN kendisi olabilir)", () => {
    const long = "bunu skill olarak kaydet " + "x".repeat(320);
    expect(parseSkillIntent(long)).toBeNull();
  });

  it("boş/anlamsız girdide null", () => {
    expect(parseSkillIntent("")).toBeNull();
    expect(parseSkillIntent("   ")).toBeNull();
  });
});
