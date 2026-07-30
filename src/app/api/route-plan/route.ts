import type { NextRequest } from "next/server";
import { checkLimit } from "@/lib/rate-limit";
import { parseBody, llmProxySchema } from "@/lib/apiSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Otomatik Pilot yönlendirme kararı (LLM-tabanlı) — "görünmez zeka"nın
   efor/kalite/füzyon kısmı artık sabit regex yerine hızlı bir model çağrısına
   dayanır (bkz. src/lib/autoPilot.ts'in decidePilotAsync'i). web/research/
   swarm hâlâ regex'te kalır (bkz. autoPilot.ts yorumu — organik araç kararları,
   ön-uçta sınıflandırılacak bir şey değil). /api/compact ile aynı sözleşme:
   anahtar istemciden gelir, sunucuda saklanmaz; hata durumunda boş döner —
   çağıran taraf (autoPilot.ts) senkron regex yedeğine düşer. */
export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "route-plan", 20, 60_000);
  if (limited) {
    return Response.json(limited.body, {
      status: limited.status,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const __v = await parseBody(req, llmProxySchema);
  if (!__v.ok) return __v.res;
  const { text, hasRepo, baseUrl, model, apiKey, fields: rawFields } = __v.data as {
    text?: string; hasRepo?: boolean; baseUrl?: string; model?: string; apiKey?: string; fields?: unknown;
  };
  if (!baseUrl || !model || !text) return Response.json({});

  /* Çağıran (autoPilot.ts) artık regex'in ZATEN emin olduğu alanları
     istemiyor — yalnız belirsiz kalan(lar)ı `fields` ile bildiriyor. Küçük
     bir istem + küçük bir tamamlama = daha hızlı bir sınıflandırma turu.
     Geçersiz/eksik `fields` → geriye dönük uyum için üçü de sorulur. */
  const ALL_FIELDS = ["effort", "quality", "fusion"] as const;
  type Field = (typeof ALL_FIELDS)[number];
  const fields: Field[] = Array.isArray(rawFields)
    ? rawFields.filter((f): f is Field => ALL_FIELDS.includes(f as Field))
    : [];
  const wanted = fields.length ? fields : ALL_FIELDS;

  const schemaParts: string[] = [];
  const ruleParts: string[] = [];
  if (wanted.includes("effort")) {
    schemaParts.push('"effort":"low|medium|high|max"');
    ruleParts.push(
      "effort: mesaj kısa/basitse 'low', normalse 'medium', kod/mimari/güvenlik/refactor gibi ağır bir " +
      "iş isteniyorsa 'high', kullanıcı açıkça 'kapsamlı/derinlemesine/baştan yaz' gibi çok kapsamlı bir " +
      "şey istiyorsa 'max'.",
    );
  }
  if (wanted.includes("quality")) {
    schemaParts.push('"quality":true|false');
    ruleParts.push("quality: kullanıcı özenli/uzun bir rapor, makale, doküman, tasarım ya da strateji istiyorsa true.");
  }
  if (wanted.includes("fusion")) {
    schemaParts.push('"fusion":true|false');
    ruleParts.push(
      "fusion: kullanıcı YALNIZCA bir SİTE/UYGULAMA/ARAYÜZ/KOD ÜRETİLMESİNİ istiyorsa (ör. 'bir landing " +
      "sayfası tasarla', 'bir React bileşeni yaz') true; sıradan sohbet/soru/hata ayıklamada false.",
    );
  }

  const messages = [
    {
      role: "system",
      content:
        `Sen bir yönlendirme sınıflandırıcısısın. Kullanıcının mesajına bakarak ${wanted.length} karar ver ve ` +
        `YALNIZCA şu JSON ile yanıt ver, başka hiçbir şey yazma:\n{${schemaParts.join(",")}}\n\n${ruleParts.join("\n")}`,
    },
    /* Sınıflandırma için mesajın tamamı gerekmiyor — ilk ~900 karakter
       niyet sinyalini taşımaya yetiyor, istem küçülüp tur hızlanıyor. */
    { role: "user", content: `Repo bağlı: ${hasRepo ? "evet" : "hayır"}\nMesaj:\n${String(text).slice(0, 900)}` },
  ];

  try {
    const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey || ""}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 20 * wanted.length, stream: false }),
      /* Zaman aşımı ŞART: istemci bu uca 4 sn'lik kendi timeout'uyla geliyor
         ama BURADAKİ upstream fetch'in sınırı yoktu — yavaş bir sağlayıcı
         lambda'yı meşgul edip istemcinin iptalinden sonra da beklemeye devam
         ediyordu. İstemci sınırının biraz altında tutuldu; hata/zaman aşımı
         zaten boş yanıta (regex yedeği) düşüyor. */
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return Response.json({});
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return Response.json({});
    const data = await res.json().catch(() => null);
    const raw: string = data?.choices?.[0]?.message?.content || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return Response.json({});
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { effort?: unknown; quality?: unknown; fusion?: unknown };
    const out: { effort?: string; quality?: boolean; fusion?: boolean } = {};
    if (wanted.includes("effort")) {
      const effort = typeof parsed.effort === "string" && ["low", "medium", "high", "max"].includes(parsed.effort)
        ? parsed.effort
        : undefined;
      if (!effort) return Response.json({});
      out.effort = effort;
    }
    if (wanted.includes("quality")) out.quality = !!parsed.quality;
    if (wanted.includes("fusion")) out.fusion = !!parsed.fusion;
    return Response.json(out);
  } catch {
    return Response.json({});
  }
}
