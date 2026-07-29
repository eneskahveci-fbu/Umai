import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/chat/route";
import { isProviderDown, __resetProviderHealthForTests } from "../providerHealth";

/* P1/P2/P3 — kullanıcı şikayeti: "istediğim model cevap vermiyor, diğer modele
   geçildi uyarısı alıyorum" (özellikle NVIDIA NIM). Kök neden: modelin
   desteklemediği opsiyonel alanlar (tools/response_format/reasoning/max_tokens)
   400'e yol açıyor, istek de doğrudan fallback zincirine düşüyordu. */

function sseText(text: string): Response {
  const enc = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: "stop" }] })}\n\n`));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), { status });
}

async function readAll(res: Response): Promise<string> {
  const r = res.body!.getReader();
  const d = new TextDecoder();
  let out = "";
  for (;;) { const { done, value } = await r.read(); if (done) break; out += d.decode(value, { stream: true }); }
  return out;
}

const NVIDIA = {
  provider: "nvidia", model: "meta/llama-3.3-70b-instruct",
  apiKey: "nvapi-test", baseUrl: "https://integrate.api.nvidia.com/v1",
};
const FALLBACK = [{ provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "gk", baseUrl: "https://api.groq.com/openai/v1" }];

function bodyOf(mock: ReturnType<typeof vi.fn>, i: number): Record<string, unknown> {
  return JSON.parse(mock.mock.calls[i]![1]!.body as string);
}
function urlOf(mock: ReturnType<typeof vi.fn>, i: number): string {
  return String(mock.mock.calls[i]![0]);
}

describe("400'de AYNI modelde yetenek düşürerek yeniden dene (P1)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("araç desteklemeyen model: tools düşürülüp aynı sağlayıcıda başarılı olur, fallback'e GEÇMEZ", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(err(400, "This model does not support tools"))
      .mockImplementation(async () => sseText("merhaba"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.60" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    const out = await readAll(await POST(req));

    /* İlk deneme araçlıydı, ikincisi araçsız — ikisi de NVIDIA'ya gitti. */
    expect(bodyOf(fetchMock, 0).tools).toBeDefined();
    expect(bodyOf(fetchMock, 1).tools).toBeUndefined();
    expect(urlOf(fetchMock, 1)).toContain("integrate.api.nvidia.com");
    /* Groq fallback'i hiç kullanılmadı → "diğer modele geçildi" uyarısı yok. */
    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes("nvidia"))).toBe(true);
    expect(out).not.toContain("fallback_event");
  });

  it("G1 — düşürme tükenip hâlâ 400 ise BİRİNCİL modelde durur, sessizce yedeğe GEÇMEZ", async () => {
    /* Davranış bilinçli olarak değişti (kullanıcı isteği): 400/422 bir
       ULAŞILABİLİRLİK arızası değil YETENEK hatasıdır ("bu isteği bu biçimde
       yapamam"). Eskiden bu durumda sessizce başka bir modele geçiliyordu →
       yanıt kullanıcının seçtiğini sandığı modelden gelmiyor, üstelik modelin
       bir şeyi yapamadığı hiç görünmüyordu. Artık zincir kırılır ve kullanıcı
       ne olduğunu okur. Kota/yetki/sunucu/bağlantı hatalarında yedek zinciri
       eskisi gibi devrede (aşağıdaki 500 testi bunu koruyor). */
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(err(400, "This model does not support tools"))
      .mockResolvedValueOnce(err(400, "response_format not supported"))
      .mockResolvedValueOnce(err(400, "still bad"))
      .mockImplementation(async () => sseText("yedekten cevap"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.61" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, jsonMode: true, fallbacks: FALLBACK }),
    });
    const out = await readAll(await POST(req));
    /* Groq'a HİÇ gidilmedi — tüm çağrılar birincil modelde kaldı. */
    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes("nvidia"))).toBe(true);
    expect(out).not.toContain("fallback_event");
  });

  it("G1 — 429 (kota) YETENEK hatası değil: yedek zinciri eskisi gibi devreye girer", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(err(429, "rate limit exceeded"))
      .mockImplementation(async () => sseText("yedekten cevap"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.66" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    await readAll(await POST(req));
    expect(urlOf(fetchMock, fetchMock.mock.calls.length - 1)).toContain("api.groq.com");
  });

  it("başarılı (200) yanıtta hiç ek deneme yapılmaz", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.62" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA }),
    });
    await readAll(await POST(req));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401'de düşürme YAPILMAZ (anahtar sorunu — alan düşürmek çözmez)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(401, "invalid api key"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.63" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA }),
    });
    await readAll(await POST(req));
    /* Tek deneme: aynı adaya tekrar tekrar gidilmedi. */
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("nvidia"))).toHaveLength(1);
  });
});

describe("OpenAI muhakeme modelleri baştan doğru parametrelerle çağrılır (P2)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("o-serisinde max_completion_tokens gönderilir, max_tokens/temperature gönderilmez", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.64" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "selam" }],
        provider: "openai", model: "o3-mini", apiKey: "sk", baseUrl: "https://api.openai.com/v1",
        temperature: 0.7, effort: "high",
      }),
    });
    await readAll(await POST(req));
    const b = bodyOf(fetchMock, 0);
    expect(b.max_completion_tokens).toBeDefined();
    expect(b.max_tokens).toBeUndefined();
    expect(b.temperature).toBeUndefined();
    /* İlk denemede geçtiği için ek tur harcanmadı. */
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normal OpenAI modelinde (gpt-4o) davranış değişmez", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseText("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.65" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "selam" }],
        provider: "openai", model: "gpt-4o", apiKey: "sk", baseUrl: "https://api.openai.com/v1",
        temperature: 0.7,
      }),
    });
    await readAll(await POST(req));
    const b = bodyOf(fetchMock, 0);
    expect(b.max_tokens).toBeDefined();
    expect(b.temperature).toBe(0.7);
    expect(b.max_completion_tokens).toBeUndefined();
  });
});

describe("sağlayıcı sağlığı yalnız SAĞLAYICI hatalarında işaretlenir (P3)", () => {
  afterEach(() => { vi.unstubAllGlobals(); __resetProviderHealthForTests(); });

  it("400 (bizim gönderdiğimiz alan) sağlayıcıyı 'down' işaretlemez", async () => {
    __resetProviderHealthForTests();
    /* Düşürme de dahil hepsi 400 → istek burada durur (G1); NVIDIA yine de
       "down" sayılmamalı: 400 bizim gönderdiğimiz alanla ilgilidir, sağlayıcı
       ayakta. Aksi hâlde sağlıklı bir sağlayıcı sonraki isteklerde haksız yere
       geri plana atılırdı. */
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(err(400, "bad request"))
      .mockResolvedValueOnce(err(400, "bad request"))
      .mockImplementation(async () => sseText("yedek"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.70" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    await readAll(await POST(req));
    expect(isProviderDown(NVIDIA.provider, NVIDIA.baseUrl)).toBe(false);
  });

  it("500 (gerçek sağlayıcı arızası) sağlayıcıyı 'down' işaretler", async () => {
    __resetProviderHealthForTests();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(err(500, "internal error"))
      .mockImplementation(async () => sseText("yedek"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.71" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    await readAll(await POST(req));
    expect(isProviderDown(NVIDIA.provider, NVIDIA.baseUrl)).toBe(true);
  });
});

describe("model KONFİGÜRASYON hatası (404/410) — sağlık sinyali DEĞİL, dürüstçe durur (I3)", () => {
  afterEach(() => { vi.unstubAllGlobals(); __resetProviderHealthForTests(); });

  it("410 Gone (canlı NVIDIA'da doğrulanan 'model emekli' durumu): BİRİNCİL modelde durur, fallback'e sessizce geçmez", async () => {
    /* Gerçek nvapi anahtarıyla canlı test edilen NVIDIA yanıtının aynısı:
       "The model 'minimaxai/minimax-m2.7' has reached its end of life on
       2026-07-27T00:00:00Z and is no longer available." */
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        type: "about:blank", title: "Gone", status: 410,
        detail: "The model 'minimaxai/minimax-m2.7' has reached its end of life on 2026-07-27T00:00:00Z and is no longer available.",
      }), { status: 410 }))
      .mockImplementation(async () => sseText("yedekten cevap"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.72" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    const out = await readAll(await POST(req));

    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes("nvidia"))).toBe(true);
    expect(out).not.toContain("fallback_event");
    expect(out).toContain("artık mevcut değil");
  });

  it("404 (yanlış/emekli model adı): BİRİNCİL modelde durur, fallback'e sessizce geçmez", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("404 page not found", { status: 404 }))
      .mockImplementation(async () => sseText("yedekten cevap"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.73" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    const out = await readAll(await POST(req));

    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes("nvidia"))).toBe(true);
    expect(out).not.toContain("fallback_event");
    expect(out).toContain("Model bulunamadı");
  });

  it("404/410 sağlayıcıyı 'down' işaretlemez (sağlayıcı ayakta, yalnız o model adı geçersiz)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 410 }));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.74" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA }),
    });
    await readAll(await POST(req));
    expect(isProviderDown(NVIDIA.provider, NVIDIA.baseUrl)).toBe(false);
  });

  it("429 (gerçek kota arızası) hâlâ eskisi gibi fallback'e geçer — 404/410 ile karıştırılmadı", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(err(429, "rate limit exceeded"))
      .mockImplementation(async () => sseText("yedekten cevap"));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.75" },
      body: JSON.stringify({ messages: [{ role: "user", content: "selam" }], ...NVIDIA, fallbacks: FALLBACK }),
    });
    await readAll(await POST(req));
    expect(urlOf(fetchMock, fetchMock.mock.calls.length - 1)).toContain("api.groq.com");
  });
});
