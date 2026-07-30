import { describe, expect, it, vi } from "vitest";
import {
  decidePilot, decidePilotAsync, pilotConfidence, isPilotConfident,
  autoEffort, autoWeb, autoResearch, autoFusion, autoImageGen, autoSwarm,
} from "../autoPilot";

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
  /* H3 — "ajan ekibi çalışmıyor". Önceden `ctx.hasRepo && autoSwarm(text)` idi
     ve bu test de o davranışı (hasRepo:false → swarm:false) doğruluyordu.
     Oysa ajan ekibinin gittiği uç (/api/orchestrate) reposuz durumu ZATEN
     destekliyor: işçiler depo yoksa dosya araçları olmadan düz model çağrısına
     düşüyor. Kapı tamamen istemci taraflıydı ve özelliği tümden kapatıyordu. */
  it("çok maddeli görev → ajan ekibi (depo GEREKMEZ)", () => {
    const t = "Şu işleri sırayla yap:\n- login sayfası ekle ve doğrulama kur\n- navbar'ı responsive olacak şekilde düzenle\n- birim testleri güncelle\n- README dosyasını yaz ve dağıtım betiği oluştur";
    expect(decidePilot(t, { hasRepo: true }).swarm).toBe(true);
    expect(decidePilot(t, { hasRepo: false }).swarm).toBe(true);
  });
  it("reasons okunur etiketler içerir", () => {
    const d = decidePilot("bugün en yeni Next.js sürümü çıktı mı?", ctx);
    expect(d.reasons).toContain("web");
  });
});

describe("pilotConfidence — alan-bazlı 'regex'ten emin miyiz' değerlendirmesi", () => {
  it("kısa mesajlarda üçü de emin (selam, kısa komut, kısa soru)", () => {
    expect(pilotConfidence("selam")).toEqual({ effort: true, quality: true, fusion: true });
    expect(pilotConfidence("bunu düzelt")).toEqual({ effort: true, quality: true, fusion: true });
    expect(pilotConfidence("peki ya bu?")).toEqual({ effort: true, quality: true, fusion: true });
  });

  it("açık 'kapsamlı' sinyalinde üçü de emin (effort=max → quality de otomatik emin)", () => {
    const t = "Bu konuyu kapsamlı ve derinlemesine ele alan, ayrıntılı bir açıklama rica ediyorum.";
    expect(pilotConfidence(t)).toEqual({ effort: true, quality: true, fusion: true });
  });

  it("kod bloklu debug isteğinde (üretim fiili YOK) üçü de emin — ağa hiç çıkılmaz", () => {
    /* Bu, önceki (tek global kapılı) tasarımın da garanti ettiği en yaygın
       durum: bir kodlama asistanında "şu kodu incele/düzelt" tipi istekler
       çoğunluk. FUSION_NOUN'un çıplak "kod" alternatifi burada eşleşir ama
       üretim FİİLİ yoksa (oluştur/yap/kodla/tasarla/geliştir vb.) autoFusion
       zaten kesin false'tur — bu yüzden isFusionConfident fiil-öncelikli. */
    const t = "Şu kodu incele ve neden hatalı olduğunu açıkla, gerekirse düzelt:\n```ts\nconst x = 1;\n```";
    expect(pilotConfidence(t)).toEqual({ effort: true, quality: true, fusion: true });
  });

  it("açık görsel/araştırma niyetinde üçü de emin", () => {
    expect(pilotConfidence("bana gün batımında sisli bir dağ manzarası çiz, çok detaylı ve renkli olsun lütfen"))
      .toEqual({ effort: true, quality: true, fusion: true });
    expect(pilotConfidence("React ile Vue arasında kapsamlı bir karşılaştırmalı analiz raporu hazırla, kaynaklarıyla anlat"))
      .toEqual({ effort: true, quality: true, fusion: true });
  });

  it("uzunca, sinyalsiz düz yazıda effort EMİN DEĞİL — LLM'e sorulmalı", () => {
    const t = "Yeni başlayan bir ürün için hem kullanıcıların hem de yatırımcıların ilgisini çekecek, biraz da rekabet analizine değinen bir sayfa hazırlar mısın";
    expect(pilotConfidence(t).effort).toBe(false);
  });

  it("üretim fiili VAR ama hedef isim YOK ise fusion belirsiz kalır", () => {
    /* "geliştir" bir üretim fiili ama metinde site/uygulama/sayfa/vb. bir
       hedef isim yok — gerçekten ara bölge (LLM'e sorulmaya değer). */
    const t = "Bugünlerde kafamda dönüp duran dağınık bir fikrim var, bunu biraz geliştir, ben de daha iyi anlayayım istiyorum.";
    expect(pilotConfidence(t).fusion).toBe(false);
  });

  it("isPilotConfident geriye dönük uyum: üçü BİRDEN emin olduğunda true", () => {
    expect(isPilotConfident("selam")).toBe(true);
    const ambiguous = "Yeni başlayan bir ürün için hem kullanıcıların hem de yatırımcıların ilgisini çekecek, biraz da rekabet analizine değinen bir sayfa hazırlar mısın";
    expect(isPilotConfident(ambiguous)).toBe(false);
  });
});

describe("decidePilotAsync — LLM-tabanlı yönlendirme + senkron yedek", () => {
  const llm = { baseUrl: "https://x", model: "m", apiKey: "k" };
  /* Bu metinde YALNIZ effort belirsiz (quality ve fusion regex'ten zaten
     emin — bkz. pilotConfidence testleri: length<400 → quality kesin false;
     "sayfa" + "hazırlar" ikisi de eşleşiyor → fusion kesin true). */
  const effortOnlyAmbiguous = "Yeni başlayan bir ürün için hem kullanıcıların hem de yatırımcıların ilgisini çekecek, biraz da rekabet analizine değinen bir sayfa hazırlar mısın";

  it("regex ÜÇÜ BİRDEN emin olduğunda ağa hiç çıkmaz, doğrudan regex kararını döner", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await decidePilotAsync("selam", ctx, llm);
    expect(d).toEqual(decidePilot("selam", ctx));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("yalnız BELİRSİZ kalan alan(lar) route-plan'a `fields` ile bildirilir", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ effort: "max" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await decidePilotAsync(effortOnlyAmbiguous, ctx, llm);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.fields).toEqual(["effort"]);
    vi.unstubAllGlobals();
  });

  it("regex'in ZATEN EMİN olduğu alanlar LLM'in FARKLI görüşüyle EZİLMEZ", async () => {
    /* Sunucu quality/fusion için de bir görüş döndürse bile (istenmediği
       hâlde bir sağlayıcı fazladan alan dönerse), yalnız `fields`'da
       istenen (effort) uygulanır — regex'in emin olduğu quality/fusion
       LOKAL kalır. Bu, önceki (tek global kapılı) tasarımın SAHİP OLMADIĞI
       bir korumadır. */
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ effort: "max", quality: true, fusion: false }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const d = await decidePilotAsync(effortOnlyAmbiguous, ctx, llm);
    const local = decidePilot(effortOnlyAmbiguous, ctx);
    expect(d.effort).toBe("max");        // LLM'den geldi (belirsizdi)
    expect(d.quality).toBe(local.quality); // LOKAL korundu (emin), sunucunun "true"su YOK SAYILDI
    expect(d.fusion).toBe(local.fusion);   // LOKAL korundu (emin), sunucunun "false"u YOK SAYILDI
    vi.unstubAllGlobals();
  });

  it("ağ hatasında senkron decidePilot'a düşer (asla fırlatmaz)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));
    const d = await decidePilotAsync(effortOnlyAmbiguous, ctx, llm);
    expect(d).toEqual(decidePilot(effortOnlyAmbiguous, ctx));
    vi.unstubAllGlobals();
  });

  it("geçersiz/eksik JSON yanıtında (istenen alan gelmemiş) senkron decidePilot'a düşer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })));
    const d = await decidePilotAsync(effortOnlyAmbiguous, ctx, llm);
    expect(d).toEqual(decidePilot(effortOnlyAmbiguous, ctx));
    vi.unstubAllGlobals();
  });

  it("llm bilgisi yoksa (baseUrl/model eksik) doğrudan senkron decidePilot'a düşer, ağ çağrısı yapmaz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await decidePilotAsync(effortOnlyAmbiguous, ctx, null);
    expect(d).toEqual(decidePilot(effortOnlyAmbiguous, ctx));
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

describe("resolveStudioSkillId — regresyon: başarısız ilk üretim sonrası kilitlenmemeli", () => {
  it("ilk mesaj (followup=false) her zaman brief'ten sınıflandırır", async () => {
    const { resolveStudioSkillId } = await import("../autoPilot");
    expect(resolveStudioSkillId({ brief: "10 slaytlık bir sunum hazırla", followup: false, projectSkillId: null })).toBe("slides");
  });
  it("takip mesajı + yerleşik (BAŞARILI üretimden gelen) skill → skill korunur, brief yok sayılır", async () => {
    const { resolveStudioSkillId } = await import("../autoPilot");
    expect(resolveStudioSkillId({ brief: "başlığı büyüt", followup: true, projectSkillId: "landing" })).toBe("landing");
  });
  it("KRİTİK regresyon: ilk üretim başarısız olup projectSkillId hâlâ null/undefined iken takip mesajı brief'ten YENİDEN sınıflandırılır (eskiden sonsuza dek undefined'a kilitleniyordu)", async () => {
    const { resolveStudioSkillId } = await import("../autoPilot");
    expect(resolveStudioSkillId({ brief: "uluslararası ilişkiler ve siber güvenlik hakkında bir sunum hazırla", followup: true, projectSkillId: null })).toBe("slides");
    expect(resolveStudioSkillId({ brief: "uluslararası ilişkiler ve siber güvenlik hakkında bir sunum hazırla", followup: true, projectSkillId: undefined })).toBe("slides");
  });
  it("şablon seçildiyse (templateSkillId) her zaman önceliklidir", async () => {
    const { resolveStudioSkillId } = await import("../autoPilot");
    expect(resolveStudioSkillId({ brief: "bir sunum yap", followup: false, projectSkillId: null, templateSkillId: "dashboard" })).toBe("dashboard");
    expect(resolveStudioSkillId({ brief: "bir sunum yap", followup: true, projectSkillId: "landing", templateSkillId: "dashboard" })).toBe("dashboard");
  });
  it("takip mesajında brief belirsizse ve yerleşik skill yoksa null döner (generateArtifact serbest format seçer)", async () => {
    const { resolveStudioSkillId } = await import("../autoPilot");
    expect(resolveStudioSkillId({ brief: "tekrar dene", followup: true, projectSkillId: null })).toBe(null);
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

/* H3 — "taşı" hiçbir zaman eşleşmiyordu. JS'te `\b` yalnız [A-Za-z0-9_]'ye
   göre tanımlıdır; `ı` bu kümede olmadığı için `\btaşı\b`'nin kapanış sınırı
   kendinden SONRA bir kelime karakteri ister → "taşı " ya da satır sonundaki
   "taşı" asla eşleşmez. (Aynı tuzak autoImageGen'de zaten belgeliydi.) */
describe("Türkçe kelime sınırı: 'taşı' (H3)", () => {
  it("autoEffort: 'taşı' ağır iş sinyali sayılır", () => {
    expect(autoEffort("bu modülü yeni klasöre taşı")).toBe("high");
    expect(autoEffort("veritabanını taşı.")).toBe("high");
  });

  it("autoEffort: 'taşı' bir kelimenin İÇİNDE geçince sinyal DEĞİL", () => {
    /* "taşımak"/"taşınabilir" gibi çekimler bu listedeki diğer maddelerle
       (ör. \bekle\b'nin "ekleme"yi saymaması) tutarlı biçimde sayılmaz. */
    expect(autoEffort("küçük bir taşınabilir not")).not.toBe("high");
  });

  it("autoSwarm: fiil sayımına 'taşı' dahil edilir", () => {
    /* Dört fiil + 280'den uzun metin → ajan ekibi. 'taşı' sayılmazsa üç fiil
       kalır ve eşik geçilmez; bu test o regresyonu yakalar. */
    const t = "Projede şunları yap: eski yapılandırma dosyasını yeni klasöre taşı, "
      + "ardından eksik olan doğrulama katmanını ekle, sonra kullanıcı listesi ekranını "
      + "yeniden düzenle ve en sonunda değişiklikleri açıklayan kısa bir özet yaz. "
      + "Bu işleri sırayla ve dikkatli yapmanı istiyorum, her adımda ne yaptığını anlat.";
    expect(t.length).toBeGreaterThan(280);
    expect(autoSwarm(t)).toBe(true);
  });
});
