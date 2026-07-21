import { describe, expect, it, vi } from "vitest";
import { decidePilot, decidePilotAsync, autoEffort, autoWeb, autoResearch, autoFusion, autoImageGen } from "../autoPilot";

const ctx = { hasRepo: true };

describe("decidePilot", () => {
  it("kısa selam → düşük efor, hiçbir mod", () => {
    const d = decidePilot("selam", ctx);
    expect(d.effort).toBe("low");
    expect(d.web).toBe(false);
    expect(d.research).toBe(false);
    expect(d.quality).toBe(false);
    expect(d.swarm).toBe(false);
  });
  it("güncel bilgi sorusu → web açık", () => {
    expect(decidePilot("bugün dolar kuru ne kadar?", ctx).web).toBe(true);
    expect(decidePilot("İstanbul'da hava durumu nasıl olacak?", ctx).web).toBe(true);
  });
  it("kod odaklı istek web tetiklemez", () => {
    const d = decidePilot("şu fonksiyonu refactor et:\n```ts\nconst x=1\n```", ctx);
    expect(d.web).toBe(false);
    expect(d.effort).toBe("high");
  });
  it("kapsamlı karşılaştırmalı rapor → research + quality (+web)", () => {
    const d = decidePilot("React ile Vue arasında kapsamlı bir karşılaştırmalı analiz raporu hazırla, artıları eksileri kaynaklarıyla anlat", ctx);
    expect(d.research).toBe(true);
    expect(d.web).toBe(true);
    expect(d.quality).toBe(true);
    expect(d.effort).toBe("max");
  });
  it("çok maddeli görev + repo → ajan ekibi", () => {
    const t = "Şu işleri sırayla yap:\n- login sayfası ekle ve doğrulama kur\n- navbar'ı responsive olacak şekilde düzenle\n- birim testleri güncelle\n- README dosyasını yaz ve dağıtım betiği oluştur";
    expect(decidePilot(t, { hasRepo: true }).swarm).toBe(true);
    expect(decidePilot(t, { hasRepo: false }).swarm).toBe(false);
  });
  it("reasons okunur etiketler içerir", () => {
    const d = decidePilot("bugün en yeni Next.js sürümü çıktı mı?", ctx);
    expect(d.reasons).toContain("web");
  });
});

describe("decidePilotAsync — LLM-tabanlı yönlendirme + senkron yedek", () => {
  const llm = { baseUrl: "https://x", model: "m", apiKey: "k" };

  it("başarılı /api/route-plan yanıtı effort/quality/fusion'ı uygular (web/research/swarm hâlâ regex'ten)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ effort: "max", quality: true, fusion: false }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const d = await decidePilotAsync("selam", ctx, llm);
    expect(d.effort).toBe("max");
    expect(d.quality).toBe(true);
    expect(d.fusion).toBe(false);
    expect(d.web).toBe(false); // regex: "selam" web tetiklemez
    vi.unstubAllGlobals();
  });

  it("ağ hatasında senkron decidePilot'a düşer (asla fırlatmaz)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));
    const d = await decidePilotAsync("kapsamlı bir mimari kur", ctx, llm);
    expect(d).toEqual(decidePilot("kapsamlı bir mimari kur", ctx));
    vi.unstubAllGlobals();
  });

  it("geçersiz/eksik JSON yanıtında senkron decidePilot'a düşer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })));
    const d = await decidePilotAsync("selam", ctx, llm);
    expect(d).toEqual(decidePilot("selam", ctx));
    vi.unstubAllGlobals();
  });

  it("llm bilgisi yoksa (baseUrl/model eksik) doğrudan senkron decidePilot'a düşer, ağ çağrısı yapmaz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await decidePilotAsync("selam", ctx, null);
    expect(d).toEqual(decidePilot("selam", ctx));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("yardımcılar", () => {
  it("autoEffort: kapsamlı → max, kısa soru → medium", () => {
    expect(autoEffort("kapsamlı bir mimari kur")).toBe("max");
    expect(autoEffort("bu nedir?")).toBe("medium");
  });
  it("autoWeb: genel bilgi sorusu tetiklemez", () => {
    expect(autoWeb("Python'da liste nasıl sıralanır?")).toBe(false);
  });
  it("autoWeb: döviz/güncel veri sorusu tetikler", () => {
    expect(autoWeb("1 dolar kaç tl")).toBe(true);
    expect(autoWeb("euro ne kadar bugün")).toBe(true);
    expect(autoWeb("gram altın fiyatı")).toBe(true);
    expect(autoWeb("bitcoin kaç dolar")).toBe(true);
  });
  it("autoResearch: kısa metinde tetiklenmez", () => {
    expect(autoResearch("kapsamlı rapor")).toBe(false);
  });
});

describe("autoImageGen — Faz 6: yalnız generate_image için doğal dil sinyali", () => {
  it("açık görsel isteklerinde tetiklenir", () => {
    expect(autoImageGen("bana gün batımında sisli bir dağ manzarası çiz")).toBe(true);
    expect(autoImageGen("bir kedi resmi oluştur")).toBe(true);
    expect(autoImageGen("draw a red fox in a snowy forest")).toBe(true);
    expect(autoImageGen("şirketim için bir logo tasarla")).toBe(true);
  });
  it("kod bağlamlı benzer cümlelerde tetiklenmez (yanlış-pozitif koruması)", () => {
    expect(autoImageGen("logo bileşeni için bir component oluştur")).toBe(false);
    expect(autoImageGen("kullanıcı fotoğrafı yükleme fonksiyonu yaz")).toBe(false);
    expect(autoImageGen("```\nconst resim = 'x'\n``` bunu düzelt")).toBe(false);
  });
  it("normal sohbet/kod isteklerinde tetiklenmez", () => {
    expect(autoImageGen("merhaba nasılsın")).toBe(false);
    expect(autoImageGen("bu fonksiyonu refactor et")).toBe(false);
    expect(autoImageGen("bir React bileşeni yaz")).toBe(false);
  });
  it("çok kısa metinde tetiklenmez", () => {
    expect(autoImageGen("resim")).toBe(false);
  });
});

describe("autoStudioSkill", () => {
  it("sunum/slayt brief'i → slides (gerçek çok-slaytlı motor, slidesGen.ts)", async () => {
    const { autoStudioSkill } = await import("../autoPilot");
    expect(autoStudioSkill("Yapay zekâ konulu 5 slaytlık bir sunum hazırla")).toBe("slides");
    expect(autoStudioSkill("yatırımcılar için pitch deck hazırla")).toBe("slides");
    /* Türkçe çekim ekleri: "sunum" değil "sunumu"/"sunumuyla" gibi biçimler
       gerçek kullanımda çok daha yaygın — \w* son eki tüketmeli. */
    expect(autoStudioSkill("Bir kahve markası için ürün lansman sunumu")).toBe("slides");
    expect(autoStudioSkill("10 slaytlık bir eğitim sunumu hazırla")).toBe("slides");
  });
  it("e-posta brief'i → email, dashboard → dashboard", async () => {
    const { autoStudioSkill } = await import("../autoPilot");
    expect(autoStudioSkill("kara cuma kampanyası için bir e-posta bülteni")).toBe("email");
    expect(autoStudioSkill("satış analitiği için dashboard tasarla")).toBe("dashboard");
  });
  it("belirsiz brief → null (varsayılana düşer)", async () => {
    const { autoStudioSkill } = await import("../autoPilot");
    expect(autoStudioSkill("güzel bir şey yap")).toBe(null);
  });
});

describe("autoFusion — füzyon yalnız üretim işlerinde", () => {
  it("site/uygulama üretim isteklerinde tetiklenir", () => {
    expect(autoFusion("bana modern bir portfolyo sitesi yap, koyu tema olsun")).toBe(true);
    expect(autoFusion("yapılacaklar listesi uygulaması oluştur react ile")).toBe(true);
    expect(autoFusion("landing sayfası tasarla: kahve dükkanı için")).toBe(true);
  });
  it("normal sohbet/soru-cevapta tetiklenmez", () => {
    expect(autoFusion("merhaba nasılsın?")).toBe(false);
    expect(autoFusion("bu sitede neden hata alıyorum sence?")).toBe(false);
    expect(autoFusion("bugün dolar kaç TL?")).toBe(false);
    expect(autoFusion("python nedir kısaca açıkla")).toBe(false);
  });
  it("çok kısa metinde tetiklenmez", () => {
    expect(autoFusion("site yap")).toBe(false);
  });
});
