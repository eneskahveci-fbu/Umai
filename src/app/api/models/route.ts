import type { Provider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ModelsRequest {
  baseUrl?: string;
  apiKey?: string;
  provider?: Provider;
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* OpenAI uyumlu sağlayıcıların `GET /models` ucundan, kullanıcının anahtarıyla
   erişebildiği gerçek model kimliklerini çeker. Böylece model adını tahmin
   etmek yerine anahtara göre listeleriz. Anahtar sunucuda saklanmaz; yalnızca
   bu istekte sağlayıcıya iletilir. */
export async function POST(req: Request) {
  if (!checkOrigin(req)) return Response.json({ error: "Geçersiz origin." }, { status: 403 });

  let body: ModelsRequest;
  try { body = await req.json(); } catch { return Response.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const baseUrl = (body.baseUrl || "").trim().replace(/\/$/, "");
  const apiKey = (body.apiKey || "").trim();
  if (!baseUrl) return Response.json({ error: "Base URL gerekli." }, { status: 400 });

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  /* Pollinations OpenAI-uyumlu uçta `/openai/models` YOKTUR; model listesi
     kök `/models` ucundadır (ör. https://text.pollinations.ai/models). Bu yüzden
     baseUrl'in sonundaki `/openai`'i atıp doğru ucu kullanırız. */
  const modelsUrl = body.provider === "pollinations"
    ? `${baseUrl.replace(/\/openai$/, "")}/models`
    : `${baseUrl}/models`;

  let upstream: Response;
  try {
    upstream = await fetch(modelsUrl, { headers });
  } catch (err) {
    return Response.json({ error: `Sağlayıcıya bağlanılamadı: ${(err as Error).message}` }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => "")).slice(0, 200);
    return Response.json(
      { error: `Modeller alınamadı (${upstream.status}). Anahtar veya Base URL'i kontrol et.`, detail },
      { status: upstream.status || 500 },
    );
  }

  let data: unknown;
  try { data = await upstream.json(); } catch { return Response.json({ error: "Sağlayıcı yanıtı çözümlenemedi." }, { status: 502 }); }

  /* OpenAI biçimi: { data: [{ id }, ...] }. Bazı sağlayıcılar düz dizi döndürür. */
  const raw = (data as { data?: unknown })?.data ?? data;
  const ids = Array.isArray(raw)
    ? raw
        .map((m) => (typeof m === "string" ? m : (m as { id?: string; name?: string })?.id ?? (m as { name?: string })?.name))
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  /* Kod/sohbet modellerini öne al, gömme (embedding) / görsel modellerini ele. */
  const filtered = ids.filter(
    (id) => !/embed|whisper|tts|moderation|image|dall-?e|stable-?diffusion|rerank/i.test(id),
  );
  const models = Array.from(new Set(filtered.length ? filtered : ids)).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );

  return Response.json({ models });
}
