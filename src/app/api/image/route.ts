import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { readJson, asString, isValidationError } from "@/lib/validate";
import { isKnownImageModel, imageModelSteps, defaultImageModel } from "@/lib/imageGen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Görüntü üretimi — kullanıcının EKLEDİĞİ modelin sağlayıcısıyla (BYOK). Anahtar
   istemciden gelir (kullanıcının kendi anahtarı), sunucu yalnızca proxy'ler;
   asla saklanmaz. Desteklenen: Gemini (native image), OpenAI & xAI (/images).
   Pollinations zaten anahtarsız ve istemcide doğrudan çalışır (buraya gelmez). */

interface Body {
  provider?: string;
  apiKey?: string;
  prompt?: string;
  size?: string;
  /** Seçilen görsel modeli (Ayarlar → Model → Görsel üretimi). Katalog dışı
      bir değer KABUL EDİLMEZ: NVIDIA'da model adı URL yoluna girdiğinden
      doğrulanmamış girdi yol enjeksiyonu olurdu. */
  model?: string;
}

interface GeminiPart { inlineData?: { data?: string; mimeType?: string } }
interface GeminiResp { candidates?: { content?: { parts?: GeminiPart[] } }[]; error?: { message?: string } }
interface OpenAIImg { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } }
/* NVIDIA NIM görsel uçları tek bir gövde biçiminde anlaşmıyor: FLUX ailesi
   {artifacts:[{base64}]} döndürürken bazı modeller {image}/{b64_json} veriyor.
   Üçünü de okuyup ilk bulduğumuzu kullanıyoruz (biçim değişirse sessizce
   kırılmak yerine "görüntü döndürmedi" hatası veririz).
   `detail`: FastAPI doğrulama hatasında (422) DİZGE değil bir DİZİ döner
   (ör. [{type,loc,msg,...}]) — gerçek anahtarla canlı test edilerek
   doğrulandı; string sanıp doğrudan göstermek "[object Object]" yazdırırdı. */
interface NvidiaImg {
  artifacts?: { base64?: string }[];
  image?: string;
  b64_json?: string;
  detail?: string | { msg?: string; message?: string }[];
  message?: string;
}

/** NVIDIA doğrulama hatasını ("422 body.steps: Input should be...") okunur tek
    satıra çevirir; zaten dizgeyse aynen döner. */
function nvidiaErrorText(j: NvidiaImg, status: number): string {
  if (typeof j.detail === "string") return j.detail;
  if (Array.isArray(j.detail) && j.detail.length) {
    return j.detail.map((d) => d.msg || d.message).filter(Boolean).join("; ");
  }
  return j.message || `NVIDIA ${status}`;
}

const OPENAI_COMPAT: Record<string, { base: string; model: string; size: boolean }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-image-1", size: true },
  xai: { base: "https://api.x.ai/v1", model: "grok-2-image", size: false },
  /* Agnes AI — standart OpenAI /images/generations ucu. `size` DESTEKLENMİYOR
     (canlı testte parametre yok sayılıyor, göndermenin faydası yok) ve yanıt
     base64 değil URL dönüyor; aşağıdaki ortak dal ikisini de zaten karşılıyor. */
  agnes: { base: "https://apihub.agnes-ai.com/v1", model: "agnes-image-2.1-flash", size: false },
};

export async function POST(req: Request) {
  const limited = rateLimit(req, "image", 20, 60_000);
  if (limited) return limited;
  let provider: string, apiKey: string, prompt: string, size: string, model: string;
  try {
    const body = await readJson(req) as Body;
    provider = (body.provider || "").trim();
    apiKey = (body.apiKey || "").trim();
    prompt = asString(body.prompt, "prompt", { max: 4000 }).trim();
    size = body.size || "1024x1024";
    /* Katalogda yoksa sessizce o sağlayıcının varsayılanına düş. */
    const wanted = (body.model || "").trim();
    model = wanted && isKnownImageModel(provider, wanted) ? wanted : defaultImageModel(provider);
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!apiKey) return NextResponse.json({ error: "Bu sağlayıcı için API anahtarı gerekli (Ayarlar → Modeller)." }, { status: 400 });

  try {
    if (provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
        signal: AbortSignal.timeout(60000),
      });
      const j = await r.json() as GeminiResp;
      if (!r.ok) return NextResponse.json({ error: j?.error?.message || `Gemini ${r.status}` }, { status: 502 });
      const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) return NextResponse.json({ error: "Gemini görüntü döndürmedi (anahtarın bu modele erişimi olmayabilir)." }, { status: 502 });
      return NextResponse.json({ image: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` });
    }

    /* Hugging Face — açık kaynak FLUX.1-schnell (ücretsiz anahtar). İkili (binary)
       görüntü döner → base64 data URL'e çevrilir. Cold-start'ta 503 dönebilir. */
    if (provider === "hf") {
      const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "image/png" },
        body: JSON.stringify({ inputs: prompt }),
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) {
        let msg = `HF ${r.status}`;
        try { const ej = await r.json() as { error?: string }; if (ej?.error) msg = ej.error; } catch { /* ikili/boş */ }
        if (r.status === 503) msg = "HF modeli yükleniyor (cold-start) — birkaç saniye sonra tekrar dene.";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
      const ct = r.headers.get("content-type") || "image/png";
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) return NextResponse.json({ error: "HF boş görüntü döndürdü — tekrar dene." }, { status: 502 });
      return NextResponse.json({ image: `data:${ct};base64,${buf.toString("base64")}` });
    }

    /* NVIDIA NIM — black-forest-labs/flux.1-dev. DİKKAT: NIM'in görsel ucu
       sohbet ucundan FARKLIDIR; OpenAI-uyumlu /images/generations değil,
       ai.api.nvidia.com/v1/genai/<model> kullanır. Bu yüzden OPENAI_COMPAT
       tablosuna eklenemez, kendi dalı gerekir.
       MODEL SEÇİMİ — gerçek bir nvapi anahtarıyla canlı test edildi:
       "black-forest-labs/flux.1-schnell" (önceki seçim) hiçbir istekte
       yanıt vermiyor, 60 sn+ asılı kalıyor (muhtemelen bu hesap altında
       bozuk/devre dışı bir dağıtım) — kullanıcının "model çok bekletiyor"
       şikâyetinin doğrudan sebebiydi. "flux.1-dev" aynı testte ~5 sn'de
       gerçek bir görüntü döndürdü; kullanılıyor.
       BOYUT KISITI — width/height keyfi değer kabul etmiyor, yalnız
       {768,832,896,960,1024,1088,1152,1216,1280,1344} kümesinden birini
       (422 ile doğrulandı). DIMENSIONS tablosundaki üç değer (1024, 1280,
       768) zaten bu kümede — ek eşleme gerekmiyor.
       ADIM SAYISI — "steps" en az 5 olmalı (422 ile doğrulandı; schnell'in
       4-adım kuralı dev için geçerli değil, dev damıtılmamış/guidance
       modelidir ve daha fazla adım ister); 25 hem hızlı (~5 sn) hem kaliteli
       çıktı verdi. */
    if (provider === "nvidia") {
      const [w, h] = size.split("x").map((n) => Number(n) || 1024);
      const r = await fetch(`https://ai.api.nvidia.com/v1/genai/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt,
          width: w,
          height: h,
          steps: imageModelSteps("nvidia", model),
          seed: 0,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const j = await r.json().catch(() => ({})) as NvidiaImg;
      if (!r.ok) {
        return NextResponse.json({ error: nvidiaErrorText(j, r.status) }, { status: 502 });
      }
      const b64 = j.artifacts?.find((a) => a.base64)?.base64 ?? j.b64_json;
      if (!b64 && !j.image) {
        return NextResponse.json(
          { error: "NVIDIA görüntü döndürmedi (anahtarın bu modele erişimi olmayabilir)." },
          { status: 502 },
        );
      }
      /* Yanıt PNG DEĞİL — canlı testte JPEG (\xff\xd8 magic) döndüğü
         doğrulandı. base64'ün ilk karakterlerinden gerçek türü SEZ; sabit
         "image/png" yazmak tarayıcıda görüntüyü sessizce bozuk gösterirdi
         (yanlış MIME ile decode edilen JPEG baytları). */
      const image = b64
        ? `data:${b64.startsWith("iVBORw0KGgo") ? "image/png" : "image/jpeg"};base64,${b64}`
        : j.image!;
      return NextResponse.json({ image });
    }

    const cfg = OPENAI_COMPAT[provider];
    if (!cfg) return NextResponse.json({ error: `'${provider}' için görüntü üretimi henüz desteklenmiyor. (Gemini, OpenAI, xAI, NVIDIA NIM, HF veya Pollinations kullan.)` }, { status: 400 });
    const payload: Record<string, unknown> = { model: model || cfg.model, prompt, n: 1 };
    if (cfg.size) payload.size = size;
    const r = await fetch(`${cfg.base}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });
    const j = await r.json() as OpenAIImg;
    if (!r.ok) return NextResponse.json({ error: j?.error?.message || `${provider} ${r.status}` }, { status: 502 });
    const d = j.data?.[0];
    const image = d?.b64_json ? `data:image/png;base64,${d.b64_json}` : d?.url;
    if (!image) return NextResponse.json({ error: "Görüntü döndürülmedi." }, { status: 502 });
    return NextResponse.json({ image });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bilinmeyen hata." }, { status: 500 });
  }
}
