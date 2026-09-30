import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLATFORM_KNOWLEDGE, PLATFORM_KNOWLEDGE_BRIEF, buildEnvironmentBlock, buildPlatformBrief, buildPlatformKnowledge,
  needsPlatformKnowledge, shelvedFeatureNote,
} from "../platform-knowledge";
import type { Features } from "../features";

const ALL_ON: Features = { designStudio: true, contentTools: true, media: true };
const ALL_OFF: Features = { designStudio: false, contentTools: false, media: false };

/* R3 — tam rehber 11 KB ≈ 3.150 token'dı ve HER isteğe koşulsuz ekleniyordu.
   Artık iki kademeli: kısa dizin her zaman, tam rehber yalnız gerektiğinde. */

describe("kısa dizin (her isteğe eklenen kademe)", () => {
  it("tam rehberden belirgin ölçüde küçük", () => {
    expect(PLATFORM_KNOWLEDGE_BRIEF.length).toBeLessThan(PLATFORM_KNOWLEDGE.length / 3);
  });

  it("tespit ıskalasa bile yönlendirebilmek için MEVCUT yüzeylerin adresini içerir", () => {
    for (const path of ["/app", "/chats", "/settings", "/library", "/tools/converter", "/projects"]) {
      expect(PLATFORM_KNOWLEDGE_BRIEF).toContain(path);
    }
  });

  it("rafa kaldırılan yüzeylerin adreslerini ANLATMAZ (olmayan menüye yönlendirmesin)", () => {
    for (const path of ["/studio/anket", "/studio/defter", "/studio/kroki", "/studio/kartlar", "/studio/dokuman", "/gorsel"]) {
      expect(buildPlatformBrief(ALL_OFF)).not.toContain(path + " ");
    }
    expect(buildPlatformBrief(ALL_OFF)).not.toMatch(/Stüdyo \(\/studio —/);
    /* /gorsel yalnız "KAPALI" notunda geçebilir; komut listesinde OLMAMALI. */
    const cmdLine = buildPlatformBrief(ALL_OFF).split("\n").find((l) => l.startsWith("Sohbet komutları")) ?? "";
    expect(cmdLine).toContain("/research");
    expect(cmdLine).not.toContain("/gorsel");
    expect(buildPlatformBrief(ALL_OFF)).toContain("Şu an KAPALI");
  });

  it("anahtar açılırsa eski yüzeyler geri gelir ve 'KAPALI' notu kalkar", () => {
    const on = buildPlatformBrief(ALL_ON);
    for (const path of ["/studio", "/studio/anket", "/studio/defter", "/studio/kroki", "/studio/kartlar", "/studio/dokuman"]) {
      expect(on).toContain(path);
    }
    expect(on).toContain("/gorsel");
    expect(on).not.toContain("Şu an KAPALI");
    expect(shelvedFeatureNote(ALL_ON)).toBe("");
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

  it("yan panel GERÇEK öğeleri anlatır: Dosyalar, Repolar bölümü, Son oturumlar", () => {
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("Dosyalar (depo ağacı)");
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("Repolar");
    expect(PLATFORM_KNOWLEDGE_BRIEF).toContain("workspace");
    expect(PLATFORM_KNOWLEDGE).toContain("Projesiz sohbet");
    expect(PLATFORM_KNOWLEDGE).toContain("Sunucu (workspace)");
  });

  it("kaldırılan 'Araçlar' menüsü ve ⋯ menüsü var gibi anlatılmıyor", () => {
    for (const t of [PLATFORM_KNOWLEDGE, PLATFORM_KNOWLEDGE_BRIEF]) {
      expect(t).not.toContain("Araçlar: küçük bir açılır panel");
      expect(t).not.toContain('"⋯" menüsünde');
      expect(t).not.toMatch(/nav[^\n]*Araçlar\b/);
    }
  });

  it("terminal bölümü var ve herkese açık olduğunu söyler", () => {
    expect(PLATFORM_KNOWLEDGE).toContain("TERMİNAL");
    expect(PLATFORM_KNOWLEDGE).toContain("herkese açık");
    expect(PLATFORM_KNOWLEDGE).toContain("run_command");
  });

  it("ücretsiz modellerin renkle gösterildiğini söyler; 'geliştirici (admin)' sekmesi yok", () => {
    expect(PLATFORM_KNOWLEDGE).toContain("turkuaz");
    expect(PLATFORM_KNOWLEDGE).toContain("Terminal & Sunucu");
    expect(PLATFORM_KNOWLEDGE).not.toContain("Geliştirici (admin)");
  });

  it("Laya'nın sohbet modeli OLMADIĞINI, araç olduğunu söyler", () => {
    expect(PLATFORM_KNOWLEDGE).toMatch(/Laya[^\n]*sohbet modeli DEĞİL/);
  });

  it("tek dosya ekleme düğmesi yansıtılmış (Ö11)", () => {
    expect(PLATFORM_KNOWLEDGE).toContain("TEK ataç düğmesi");
    expect(PLATFORM_KNOWLEDGE).not.toContain("Ekle (dosya/görsel)");
  });
});

describe("tam rehber özellik anahtarlarına bağlı", () => {
  it("kapalıyken Stüdyo/içerik araçları/görsel/Kütüphane bölümleri YOK", () => {
    const off = buildPlatformKnowledge(ALL_OFF);
    for (const h of ["STÜDYO (/studio", "İÇERİK ARAÇLARI", "GÖRSEL ÜRETİMİ", "KÜTÜPHANE (/library)"]) {
      expect(off).not.toContain(h);
    }
    expect(off).toContain("Şu an KAPALI");
    expect(off).not.toContain("/gorsel (AI görsel üret");
  });

  it("açıkken eski bölümler aynen geri gelir", () => {
    const on = buildPlatformKnowledge(ALL_ON);
    for (const h of ["STÜDYO (/studio", "İÇERİK ARAÇLARI", "GÖRSEL ÜRETİMİ", "KÜTÜPHANE (/library)"]) {
      expect(on).toContain(h);
    }
    expect(on).toContain("/gorsel (AI görsel üret");
    expect(on).not.toContain("Şu an KAPALI");
  });

  it("varsayılan (şu anki) kurulum: rafa kalkanlar anlatılmaz", () => {
    expect(PLATFORM_KNOWLEDGE).not.toContain("STÜDYO (/studio");
    expect(PLATFORM_KNOWLEDGE_BRIEF).not.toMatch(/Stüdyo \(\/studio —/);
  });

  it("tam rehber eskisinden belirgin küçük (~17,7 KB idi)", () => {
    expect(PLATFORM_KNOWLEDGE.length).toBeLessThan(11_000);
  });
});

describe("[Ortam] bloğu — opencode/Claude Code tarzı canlı ortam bilgisi", () => {
  const NOW = new Date("2026-09-30T10:00:00Z");

  it("bugünün tarihini Türkçe verir (modelin kendi bilgisi eski kalır)", () => {
    const env = buildEnvironmentBlock({ now: NOW });
    expect(env).toContain("[Ortam]");
    expect(env).toContain("30 Eylül 2026");
  });

  it("bağlı proje, dal ve sağlayıcıyı söyler; araçlar/terminal/eklentiler yansır", () => {
    const env = buildEnvironmentBlock({
      now: NOW, repo: { owner: "ekip", repo: "api", branch: "dev", provider: "gitlab" },
      toolsOn: true, terminal: true, mcpNames: ["Laya (karar modeli)", "Zaman"],
    });
    expect(env).toContain("ekip/api (dal: dev) — GitLab");
    expect(env).toContain("Araçlar: AÇIK");
    expect(env).toContain("terminalde komut çalıştır");
    expect(env).toContain("Laya (karar modeli), Zaman");
  });

  it("projesiz sohbette dosya araçları olmadığını açıkça söyler (uydurma eylem yapmasın)", () => {
    const env = buildEnvironmentBlock({ now: NOW });
    expect(env).toContain("Proje: yok");
    expect(env).toContain("Araçlar: kapalı");
    expect(env).toContain("Terminal: yok");
    expect(env).not.toContain("Bağlı eklentiler");
  });

  it("yerel mod + depo yok: 'local/local' göstermez, sunucu çalışma klasörünü söyler", () => {
    const env = buildEnvironmentBlock({ now: NOW, repo: { owner: "local", repo: "local", provider: "local" }, localBridge: true, toolsOn: true, terminal: true });
    expect(env).not.toContain("local/local");
    expect(env).toContain("kullanıcının sunucusundaki çalışma klasörü");
    expect(env).toContain("gerçek dosya sistemi + kabuk");
  });

  it("küçük kalır (ilk token gecikmesini büyütmesin)", () => {
    const env = buildEnvironmentBlock({
      now: NOW, repo: { owner: "ekip", repo: "api", branch: "dev", provider: "github" },
      toolsOn: true, terminal: true, mcpNames: ["A", "B", "C"],
    });
    expect(env.length).toBeLessThan(700);
  });
});

describe("iki yola da bağlı: sunucu ve tarayıcıdaki doğrudan-Pollinations", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("/api/chat [Ortam] bloğunu sistem promptuna ekler ve eklenti adlarını taşır", () => {
    const src = read("src/app/api/chat/route.ts");
    expect(src).toContain("buildEnvironmentBlock(");
    expect(src).toContain('name?: string;');
  });

  it("Pollinations doğrudan yolu artık HER mesaja tam rehber yollamaz (iki kademe + ortam)", () => {
    const src = read("src/components/CoderView.tsx");
    expect(src).toContain("needsPlatformKnowledge(_lastUserText)");
    expect(src).toContain("PLATFORM_KNOWLEDGE_BRIEF");
    expect(src).not.toMatch(/finalSystemPrompt \+ "\\n\\n" \+ PLATFORM_KNOWLEDGE \+ buildContextSections/);
  });

  it("CLAUDE.md de proje kuralı olarak okunur (opencode ile aynı)", () => {
    expect(read("src/app/api/chat/route.ts")).toContain('"AGENTS.md", "CLAUDE.md"');
  });
});
