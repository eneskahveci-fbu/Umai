import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLATFORM_KNOWLEDGE, PLATFORM_KNOWLEDGE_BRIEF, needsPlatformKnowledge } from "../platform-knowledge";

/* R3 — tam rehber 11 KB ≈ 3.150 token'dı ve HER isteğe koşulsuz ekleniyordu.
   Artık iki kademeli: kısa dizin her zaman, tam rehber yalnız gerektiğinde. */

describe("kısa dizin (her isteğe eklenen kademe)", () => {
  it("tam rehberden belirgin ölçüde küçük", () => {
    expect(PLATFORM_KNOWLEDGE_BRIEF.length).toBeLessThan(PLATFORM_KNOWLEDGE.length / 4);
  });

  it("tespit ıskalasa bile yönlendirebilmek için tüm yüzeylerin adresini içerir", () => {
    for (const path of ["/studio", "/studio/anket", "/studio/defter", "/studio/kroki",
      "/studio/kartlar", "/studio/dokuman", "/library", "/tools/converter", "/projects", "/chats"]) {
      expect(PLATFORM_KNOWLEDGE_BRIEF).toContain(path);
    }
  });

  it("çıktı biçimi kurallarını korur (kısaltmada düşmemeli)", () => {
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("Türkçe ve markdown");
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("dil:dosya/yolu");
  });

  it("bilmediğini uydurmamasını söyler", () => {
    expect(PLATFORM_KNOWLEDGE_BRIEF).toMatch(/uydurma/i);
  });
});

describe("needsPlatformKnowledge", () => {
  it("arayüz/konum sorularında tam rehberi ister", () => {
    for (const q of [
      "Ayarlar nerede?",
      "Stüdyo'da sunum nasıl yaparım",
      "eklenti eklemek istiyorum",
      "kütüphaneye nereden ulaşırım",
      "bu butonun adı ne",
      "Umai hangi özelliklere sahip",
      "API anahtarımı nereye gireceğim",
      "temayı nasıl değiştiririm",
      "sohbeti dışa aktarmak istiyorum",
      "skill nasıl eklenir",
    ]) {
      expect(needsPlatformKnowledge(q), q).toBe(true);
    }
  });

  it("sıradan kodlama/sohbet isteklerinde tam rehberi İSTEMEZ", () => {
    for (const q of [
      "merhaba",
      "bu fonksiyonu refactor eder misin",
      "TypeScript'te generic nasıl yazılır",
      "şu SQL sorgusunu optimize et",
      "bana bir fibonacci fonksiyonu yaz",
      "React'te useEffect ne zaman çalışır",
    ]) {
      expect(needsPlatformKnowledge(q), q).toBe(false);
    }
  });

  it("boş/tanımsız girdide çökmez", () => {
    expect(needsPlatformKnowledge("")).toBe(false);
    expect(needsPlatformKnowledge(undefined as unknown as string)).toBe(false);
  });
});

/* Ö2 (kullanıcı isteği): platform bilgisi TÜM modellere/yollara ulaşsın ve
   içeriği GERÇEKLE uyuşsun. Önceden yalnız /api/chat ve doğrudan-Pollinations
   yolu enjekte ediyordu; ajan ekibinin KENDİSİ (/api/orchestrate) ve derin
   araştırma (/api/research) bu bilgiyi hiç almıyordu. Stüdyo motorları
   /api/chat üzerinden gittiği için zaten kapsamdaydı. */
describe("platform bilgisi tüm yollara (Ö2)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("/api/orchestrate hem birleştiriciye hem İŞÇİ ajanlara dizini ekler", () => {
    const src = read("src/app/api/orchestrate/route.ts");
    expect(src).toContain('from "@/lib/platform-knowledge"');
    /* İki ayrı enjeksiyon: baseSys (planlayıcı+birleştirici) ve workerSys. */
    expect(src.match(/PLATFORM_KNOWLEDGE_BRIEF/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("/api/research dizini alır", () => {
    const src = read("src/app/api/research/route.ts");
    expect(src).toContain("PLATFORM_KNOWLEDGE_BRIEF");
  });
});

describe("platform bilgisi içeriği gerçekle uyuşur (Ö2)", () => {
  it("ajan ekibinin depo gerektirdiği iddiası KALDIRILDI (H3'ten sonra yanlış)", () => {
    expect(PLATFORM_KNOWLEDGE).not.toContain("repo bağlıyken kendiliğinden devreye girebilir");
    expect(PLATFORM_KNOWLEDGE).toContain("DEPO BAĞLI OLMASI GEREKMEZ");
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("DEPO BAĞLI OLMASI GEREKMEZ");
  });

  it("ajan rolleri ve üst sınır belgelenmiş", () => {
    for (const role of ["mimar", "kodlayıcı", "test", "inceleyici", "araştırmacı"]) {
      expect(PLATFORM_KNOWLEDGE).toContain(role);
    }
    expect(PLATFORM_KNOWLEDGE).toContain("dispatch_agents");
    expect(PLATFORM_KNOWLEDGE).toContain("En fazla 4 işçi");
  });

  it("Araçlar menüsü gerçek öğeleri listeler (Dosyalar/Sunucu dahil)", () => {
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("Dosyalar (depo ağacı)");
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("Sunucu (workspace)");
    expect(PLATFORM_KNOWLEDGE).toContain("Dosyalar (depo)");
  });

  it("kaldırılan ⋯ menüsü hâlâ var gibi anlatılmıyor", () => {
    expect(PLATFORM_KNOWLEDGE).not.toContain('"⋯" menüsünde artık yalnız');
    expect(PLATFORM_KNOWLEDGE).toContain("TAMAMEN kaldırıldı");
  });

  it("tek dosya ekleme düğmesi yansıtılmış (Ö11)", () => {
    expect(PLATFORM_KNOWLEDGE).toContain("TEK ataç düğmesi");
    expect(PLATFORM_KNOWLEDGE).not.toContain("Ekle (dosya/görsel)");
  });
});
