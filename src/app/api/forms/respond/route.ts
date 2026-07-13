import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { readJson, isValidationError } from "@/lib/validate";

export const runtime = "nodejs";

/* Anket merkezî yanıt toplama ucu. Dışa aktarılan form HTML'i sandbox'lı
   iframe'de (/a/<id> — opak origin) ya da indirilen dosyada (file://) çalışır;
   iki durumda da istek Origin "null" ile gelir. Bu yüzden uç CORS'a açıktır:
   kimlik bilgisi taşınmaz, yalnız anonim INSERT yapılır. Yanıtlar RLS gereği
   YALNIZ formun sahibi (published_forms kaydı) tarafından okunabilir. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* form_xxx / fq_xxx üretim desenimizle uyumlu, genel-güvenli kimlik. */
const FORM_ID_RE = /^[a-z0-9_-]{4,64}$/i;
const MAX_ANSWERS = 60;        // MAX_FORM_QUESTIONS (40) + pay
const MAX_ANSWER_CHARS = 4000; // tek yanıt hücresi üst sınırı

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "form-respond", 10, 60_000);
  if (limited) {
    return NextResponse.json(limited.body, {
      status: limited.status,
      headers: { ...CORS, "Retry-After": String(limited.retryAfter) },
    });
  }
  try {
    const { formId, answers } = await readJson(req) as { formId?: unknown; answers?: unknown };
    if (typeof formId !== "string" || !FORM_ID_RE.test(formId)) {
      return NextResponse.json({ error: "Geçersiz form kimliği" }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > MAX_ANSWERS) {
      return NextResponse.json({ error: "Geçersiz yanıt listesi" }, { status: 400, headers: CORS });
    }
    const clean = answers.map((a) => (typeof a === "string" ? a.slice(0, MAX_ANSWER_CHARS) : ""));
    if (!clean.some((a) => a.trim() !== "")) {
      return NextResponse.json({ error: "Boş yanıt" }, { status: 400, headers: CORS });
    }

    const sb = await createClient();
    if (!sb) return NextResponse.json({ error: "Veritabanı bağlantısı yok" }, { status: 503, headers: CORS });

    const { error } = await sb.from("form_responses").insert({ form_id: formId, answers: clean });
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status, headers: CORS });
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
