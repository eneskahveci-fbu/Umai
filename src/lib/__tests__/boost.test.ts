import { describe, expect, it, vi, afterEach } from "vitest";
import { pickDraftModels, buildBoostInstruction, fillSelfConsistency, parseJudge, generateDrafts, DRAFT_TEMPS } from "../boost";
import type { FallbackCandidate } from "../fallback";
import type { ModelProfile } from "../types";

function sseResponse(text: string, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

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

  describe("freeModelNames (Pollinations ücretsiz yedek)", () => {
    const solo = m("only", "pollinations");
    it("kullanıcının listesinde çeşitlilik yoksa ücretsiz Pollinations modelinden ikinci taslak eklenir", () => {
      const picks = pickDraftModels([solo], solo, 2, null, ["openai", "mistral"]);
      expect(picks).toHaveLength(2);
      expect(picks[1].provider).toBe("pollinations");
      expect(picks[1].id).toBe("pollinations:openai");
    });
    it("aktif model zaten o Pollinations modeliyse aynısı tekrar seçilmez", () => {
      const active = { ...solo, model: "openai" };
      const picks = pickDraftModels([active], active, 2, null, ["openai", "mistral"]);
      expect(picks[1].model).toBe("mistral");
    });
    it("freeModelNames boşsa/verilmezse tek taslakta kalır (geriye dönük uyumlu)", () => {
      expect(pickDraftModels([solo], solo, 2, null, []).length).toBe(1);
      expect(pickDraftModels([solo], solo, 2).length).toBe(1);
    });
    it("kullanıcının kendi listesinde gerçek çeşitlilik varsa freeModelNames'e hiç bakılmaz", () => {
      const picks = pickDraftModels(models, models[0], 2, models[1], ["openai"]);
      expect(picks.map((x) => x.id)).toEqual(["a", "b"]);
    });
  });

  describe("manualModelIds (Fusion Ayarları → Manuel mod)", () => {
    it("verilirse çeşitlilik sezgisi yerine doğrudan seçili modelleri sırayla kullanır", () => {
      const picks = pickDraftModels(models, models[0], 2, models[1], undefined, ["c", "b"]);
      expect(picks.map((x) => x.id)).toEqual(["c", "b"]);
    });
    it("count'a kırpar", () => {
      const picks = pickDraftModels(models, models[0], 1, undefined, undefined, ["b", "c"]);
      expect(picks.map((x) => x.id)).toEqual(["b"]);
    });
    it("hiçbiri models'te bulunamazsa (silinmiş) otomatik sezgiye zarifçe düşer", () => {
      const picks = pickDraftModels(models, models[0], 2, models[1], undefined, ["silinmis-1", "silinmis-2"]);
      expect(picks.map((x) => x.id)).toEqual(["a", "b"]);
    });
    it("boş dizi verilirse otomatik sezgi kullanılır (geriye dönük uyumlu)", () => {
      const picks = pickDraftModels(models, models[0], 2, models[1], undefined, []);
      expect(picks.map((x) => x.id)).toEqual(["a", "b"]);
    });
  });

  describe("count 3 — üçüncü taslak her zaman ücretsiz Pollinations'tan", () => {
    it("aktif + en güçlü + ücretsiz üçüncü model", () => {
      const picks = pickDraftModels(models, models[0], 3, models[1], ["openai", "mistral"]);
      expect(picks.map((x) => x.id)).toEqual(["a", "b", "pollinations:openai"]);
    });
    it("ikinci taslak zaten ücretsiz Pollinations'tan geldiyse üçüncüsü FARKLI bir modelden gelir", () => {
      const solo = m("only", "pollinations");
      const picks = pickDraftModels([solo], solo, 3, null, ["openai", "mistral", "deepseek"]);
      expect(picks.map((x) => x.model)).toEqual(["only", "openai", "mistral"]);
    });
    it("freeModelNames tükenirse üçüncü taslak eklenmez (yalnız 2 kalır)", () => {
      const picks = pickDraftModels(models, models[0], 3, models[1], []);
      expect(picks.map((x) => x.id)).toEqual(["a", "b"]);
    });
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

describe("fillSelfConsistency — tek modelde bile 3 gerçek taslak", () => {
  const active = m("aktif", "pollinations");
  it("eksik slotları aktif modelin farklı sıcaklıklı kopyalarıyla doldurur", () => {
    const slots = fillSelfConsistency([active], active, 3);
    expect(slots).toHaveLength(3);
    expect(slots[1].profile.model).toBe(active.model);
    expect(new Set(slots.map((s) => s.temperature)).size).toBeGreaterThan(1);
    expect(slots[1].profile.id).not.toBe(slots[2].profile.id); // kimlikler benzersiz
  });
  it("yeterli model varsa dolgu yapmaz, sıcaklıkları sırayla atar", () => {
    const picks = [m("a", "gemini"), m("b", "groq"), m("c", "pollinations")];
    const slots = fillSelfConsistency(picks, picks[0], 3);
    expect(slots.map((s) => s.profile.id)).toEqual(["a", "b", "c"]);
    expect(slots.map((s) => s.temperature)).toEqual(DRAFT_TEMPS);
  });
  it("count'tan fazla pick gelirse kırpar", () => {
    const picks = [m("a", "x"), m("b", "y"), m("c", "z")];
    expect(fillSelfConsistency(picks, picks[0], 2)).toHaveLength(2);
  });
});

describe("parseJudge — hakem kararı ayıklama", () => {
  it("düz JSON kararını okur", () => {
    expect(parseJudge('{"best": 2, "guidance": "taslak 1 daha kısa"}', 3)).toEqual({ best: 2, guidance: "taslak 1 daha kısa" });
  });
  it("kod çiti + fazla metne dayanıklıdır", () => {
    const j = parseJudge('Karar:\n```json\n{"best": 1, "guidance": "x"}\n```\nBitti.', 3);
    expect(j?.best).toBe(1);
  });
  it("aralık dışı/bozuk kararda null döner", () => {
    expect(parseJudge('{"best": 9, "guidance": "x"}', 3)).toBeNull();
    expect(parseJudge("json yok", 3)).toBeNull();
    expect(parseJudge('{"best": "iki"}', 3)).toBeNull();
  });
});

describe("buildBoostInstruction — hakem kararıyla", () => {
  it("hakem varsa omurga talimatı ekler", () => {
    const s2 = buildBoostInstruction(["a".repeat(50), "b".repeat(50)], { best: 2, guidance: "ilkinden başlığı al" });
    expect(s2).toContain("HAKEM KARARI");
    expect(s2).toContain("2. taslak");
    expect(s2).toContain("ilkinden başlığı al");
  });
  it("hakem yoksa eski davranış (geriye dönük uyumlu)", () => {
    expect(buildBoostInstruction(["x".repeat(50)])).not.toContain("HAKEM");
  });
});

describe("generateDrafts — DraftResult model eşlemesi (Fusion rozeti mislabeling düzeltmesi)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bir slot elense bile kalan taslaklar KENDİ ürettikleri modelle etiketlenir", async () => {
    const models = [
      { baseUrl: "https://x", model: "model-A", provider: "custom", apiKey: "k" },
      { baseUrl: "https://x", model: "model-B", provider: "custom", apiKey: "k" },
      { baseUrl: "https://x", model: "model-C", provider: "custom", apiKey: "k" },
    ];
    /* model-A başarısız (ör. kota/erişim hatası) — ÖNCEKİ hatalı davranışta
       kalan 2 taslak "slots'un İLK 2'si" (A, B) olarak etiketlenirdi; doğrusu
       GERÇEKTEN üreten B ve C olmalı. */
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { model: string };
      if (body.model === "model-A") return new Response(null, { status: 500 });
      return sseResponse(`${body.model} taslağının metni buraya yazılır tam olarak.`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await generateDrafts({ userText: "brief", models });
    expect(results.map((r) => r.model)).toEqual(["model-B", "model-C"]);
    expect(results[0].text).toContain("model-B");
    expect(results[1].text).toContain("model-C");
  });

  it("hata alan slot fallback'ten üretirse GERÇEK (yedek) modelle etiketlenir", async () => {
    const models = [{ baseUrl: "https://x", model: "model-A", provider: "custom", apiKey: "k" }];
    const fallback: FallbackCandidate = { baseUrl: "https://y", model: "model-YEDEK", provider: "custom", apiKey: "k2" };
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { model: string };
      if (body.model === "model-A") return new Response(null, { status: 500 });
      return sseResponse(`${body.model} yedek taslağının metni buraya yazılır tam olarak.`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await generateDrafts({ userText: "brief", models, fallbacks: [fallback] });
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe("model-YEDEK");
  });
});
