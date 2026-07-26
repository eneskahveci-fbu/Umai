import { describe, expect, it } from "vitest";
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
