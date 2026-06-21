import { NextResponse } from "next/server";

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
}

interface GeminiPart { inlineData?: { data?: string; mimeType?: string } }
interface GeminiResp { candidates?: { content?: { parts?: GeminiPart[] } }[]; error?: { message?: string } }
interface OpenAIImg { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } }

const OPENAI_COMPAT: Record<string, { base: string; model: string; size: boolean }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-image-1", size: true },
  xai: { base: "https://api.x.ai/v1", model: "grok-2-image", size: false },
};

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json() as Body; } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const provider = (body.provider || "").trim();
  const apiKey = (body.apiKey || "").trim();
  const prompt = (body.prompt || "").trim();
  const size = body.size || "1024x1024";
  if (!prompt) return NextResponse.json({ error: "Prompt boş." }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "Bu sağlayıcı için API anahtarı gerekli (Ayarlar → Modeller)." }, { status: 400 });

  try {
    if (provider === "gemini") {
      const model = "gemini-2.5-flash-image-preview";
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

    const cfg = OPENAI_COMPAT[provider];
    if (!cfg) return NextResponse.json({ error: `'${provider}' için görüntü üretimi henüz desteklenmiyor. (Gemini, OpenAI, xAI veya Pollinations kullan.)` }, { status: 400 });
    const payload: Record<string, unknown> = { model: cfg.model, prompt, n: 1 };
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
