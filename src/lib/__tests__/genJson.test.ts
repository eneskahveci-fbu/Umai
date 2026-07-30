import { describe, it, expect, vi, beforeEach } from "vitest";

/* `importOriginal` KULLANILMIYOR — vitest'te iki adım derinlikteki modüllere
   sızmıyor (bkz. slidesGen.test.ts'teki aynı not). genChat artık yalnız
   taşımayı dışa verdiği için düz fabrika yeterli. */
const mockedStreamChat = vi.hoisted(() => vi.fn());
vi.mock("../genChat", () => ({ streamChat: mockedStreamChat }));

import { streamJson, STRICT_JSON_RETRY_SUFFIX } from "../genJson";
import { extractJsonObject } from "../jsonExtract";
import { ModelOutputError } from "../friendlyError";

const parseJson = (raw: string) => JSON.parse(extractJsonObject(raw)) as { ok?: number };

/* Denetim bulgusu (Tem 2026): Sunum motorunda üç koruma vardı (native JSON
   modu, token bütçesi, katı yeniden deneme) ama AYNI çekirdeği kullanan
   Doküman/Anket/Defter/Kroki/Kartlar hiçbirine sahip değildi — aynı model
   Sunum'da çalışırken diğerlerinde tek denemede ölüyordu. */
describe("streamJson — beş stüdyonun ortak dayanıklılık katmanı", () => {
  beforeEach(() => mockedStreamChat.mockReset());

  it("her zaman native JSON modu ve verilen token bütçesiyle çağırır", async () => {
    mockedStreamChat.mockResolvedValueOnce('{"ok":1}');
    await streamJson({ system: "S", messages: [], maxTokens: 12_345, parse: parseJson });
    const call = mockedStreamChat.mock.calls[0]![0];
    expect(call.jsonMode).toBe(true);
    expect(call.maxTokens).toBe(12_345);
  });

  it("ilk yanıt düz metinse KATI talimatla bir kez daha dener ve başarılı olur", async () => {
    mockedStreamChat
      .mockResolvedValueOnce("Tabii! İşte istediğin doküman: burada JSON yok.")
      .mockResolvedValueOnce('{"ok":2}');
    const out = await streamJson({ system: "S", messages: [], maxTokens: 100, parse: parseJson });
    expect(out).toEqual({ ok: 2 });
    expect(mockedStreamChat).toHaveBeenCalledTimes(2);
    expect(mockedStreamChat.mock.calls[1]![0].system).toContain(STRICT_JSON_RETRY_SUFFIX.trim().slice(0, 20));
  });

  it("motorun kendi Türkçe ayrıştırma hatası da yeniden denemeyi tetikler", async () => {
    const strictParse = (raw: string) => {
      if (!raw.includes("iyi")) throw new Error("Doküman JSON'u bozuk — tekrar dene.");
      return { ok: 3 };
    };
    mockedStreamChat.mockResolvedValueOnce("kotu").mockResolvedValueOnce("iyi");
    await expect(streamJson({ system: "S", messages: [], maxTokens: 100, parse: strictParse }))
      .resolves.toEqual({ ok: 3 });
    expect(mockedStreamChat).toHaveBeenCalledTimes(2);
  });

  it("iki deneme de başarısızsa hata MODELİN kendi metnini taşır (yalnız BİR kez dener)", async () => {
    mockedStreamChat
      .mockResolvedValueOnce("düz metin 1")
      .mockResolvedValueOnce("Üzgünüm, bir sunum dosyası üretemem.");
    await expect(streamJson({ system: "S", messages: [], maxTokens: 100, parse: parseJson }))
      .rejects.toThrow(/sunum dosyası üretemem/);
    expect(mockedStreamChat).toHaveBeenCalledTimes(2);
  });

  it("boş yanıt, düz metinden AYRI sınıflandırılır", async () => {
    mockedStreamChat.mockResolvedValue("   ");
    await expect(streamJson({ system: "S", messages: [], maxTokens: 100, parse: parseJson }))
      .rejects.toThrow(/boş yanıt/i);
  });

  it("AbortError'da yeniden DENEMEZ (kullanıcı iptal ettiyse tekrar istek atma)", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    mockedStreamChat.mockRejectedValueOnce(abort);
    await expect(streamJson({ system: "S", messages: [], maxTokens: 100, parse: parseJson })).rejects.toThrow();
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });

  /* Yapılandırma/kimlik/kota hataları ayrıştırma sorunu değil: ikinci deneme
     yalnız beklemeyi ikiye katlar ve ilk (doğru) hatayı ezerdi. */
  it("model/anahtar yapılandırma hatasında yeniden DENEMEZ, hatayı hemen yükseltir", async () => {
    mockedStreamChat.mockRejectedValueOnce(new Error("Önce Ayarlar → Modeller'den bir model seç."));
    await expect(streamJson({ system: "S", messages: [], maxTokens: 100, parse: parseJson }))
      .rejects.toThrow(/Ayarlar/);
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });

  it("401/429 gibi sağlayıcı hatalarında da yeniden DENEMEZ", async () => {
    mockedStreamChat.mockRejectedValueOnce(new Error("HTTP 401 Unauthorized"));
    await expect(streamJson({ system: "S", messages: [], maxTokens: 100, parse: parseJson })).rejects.toThrow();
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });
});

describe("extractJsonObject — dürüst hata mesajları", () => {
  it("düz metin yanıtta modelin metnini alıntılar", () => {
    expect(() => extractJsonObject("Slayt dosyası oluşturamam çünkü bu platformda…"))
      .toThrow(/Slayt dosyası oluşturamam/);
    expect(() => extractJsonObject("düz metin")).toThrow(ModelOutputError);
  });
  it("boş yanıtı ayrı sınıflandırır", () => {
    expect(() => extractJsonObject("")).toThrow(/boş yanıt/i);
  });
  it("yarım kalan JSON'u token sınırı olarak bildirir", () => {
    expect(() => extractJsonObject('{"title":"yarim ka')).toThrow(/yarıda kesildi/i);
  });
  it("geçerli JSON'u (çitli veya çitsiz) ayıklar", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonObject('Buyur: {"a":{"b":2}} kolay gelsin')).toBe('{"a":{"b":2}}');
  });
});
