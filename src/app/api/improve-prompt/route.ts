import type { NextRequest } from "next/server";
import { checkLimit } from "@/lib/rate-limit";
import { parseBody, llmProxySchema } from "@/lib/apiSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Taslak istem iyileştirme — dar, tek amaçlı bir tamamlama. ÖNCEDEN composer'daki
   "Prompt geliştir" /api/chat'i (asıl sohbet/ajan uç noktası) çağırıyordu; o rota
   HER isteğe (bu dahil, `tools:false` geçilse bile) ask_user'ı teşvik eden bir
   "[Açıklayıcı diyalog]" talimatı + model kimliği + platform bilgisi enjekte
   ediyor — hiçbiri koşullu değil (bkz. route.ts'teki sysPrompt inşası). Sonuç:
   kullanıcı KISA/BELİRSİZ bir taslak yazıp iyileştirmesini istediğinde (tam da bu
   özelliğin var olma sebebi), model taslağı "belirsiz istek" sayıp GFM checkbox'lı
   bir açıklayıcı soru listesiyle yanıt veriyordu — bu da doğrudan composer'a
   yazılınca kullanıcının taslağını bir soru listesine çeviriyordu ("yanlış
   çalışıyor" şikayeti). /api/compact ile AYNI dar-tamamlama deseni: doğrudan
   sağlayıcı çağrısı, yalnız görev-özel sistem mesajı, ajan çerçevesi yok. */
export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "improve-prompt", 20, 60_000);
  if (limited) {
    return Response.json(limited.body, {
      status: limited.status,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const __v = await parseBody(req, llmProxySchema);
  if (!__v.ok) return __v.res;
  const { text, baseUrl, model, apiKey } = __v.data as {
    text?: string; baseUrl?: string; model?: string; apiKey?: string;
  };
  /* apiKey KASITLI OLARAK zorunlu değil — Pollinations gibi anahtarsız
     sağlayıcılar boş string gönderir (bkz. POLLINATIONS_DEFAULT_MODEL,
     misafir modunun varsayılanı). /api/route-plan ile AYNI kural. İlk canlı
     testte tam bu yüzden anında boş dönüyordu: `!apiKey` bekletmeden bailout
     ediyordu, gerçek çağrı hiç atılmıyordu. */
  if (!baseUrl || !model || !text) {
    return Response.json({ improved: "" });
  }

  const messages = [
    {
      role: "system",
      content:
        "Sen bir prompt mühendisisin. Kullanıcının taslak istemini; amacını koruyarak " +
        "daha NET, eksiksiz ve etkili bir isteme dönüştür. Gerekli bağlamı, beklenen çıktı " +
        "biçimini ve kısıtları ekle. Taslak kısa ya da belirsiz olsa bile SORU SORMA — " +
        "makul varsayımlarla doldur ve yalnızca geliştirilmiş istemi döndür. Açıklama, " +
        "tırnak veya etiket yazma. Kullanıcının diliyle aynı dilde yaz.",
    },
    { role: "user", content: String(text).slice(0, 8000) },
  ];

  try {
    const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 800, temperature: 0.7, stream: false }),
    });
    if (!res.ok) return Response.json({ improved: "" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return Response.json({ improved: "" });
    const data = await res.json().catch(() => null);
    const improved: string = data?.choices?.[0]?.message?.content || "";
    return Response.json({ improved: improved.trim() });
  } catch {
    return Response.json({ improved: "" });
  }
}
