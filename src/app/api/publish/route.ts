import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { readJson, asContent, isValidationError } from "@/lib/validate";

export const runtime = "nodejs";

const VALID_TYPES = new Set(["html", "svg", "mermaid"]);
const MAX_CONTENT_BYTES = 300_000; // ~300KB (bayt bazlı — asContent 413 döner)

/* Artifact yayınlama: bir artifact'ı (html/svg/mermaid) bağımsız, paylaşılabilir
   bir sayfaya (/a/<id>) çevirir. /api/share deseninin aynısı. */
export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "publish", 10, 60_000);
  if (limited) return NextResponse.json(limited.body, { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const { title, type, content: rawContent } = await readJson(req) as { title?: unknown; type?: unknown; content?: unknown };
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "Geçersiz artifact türü" }, { status: 400 });
    }
    const content = asContent(rawContent, MAX_CONTENT_BYTES);

    const sb = await createClient();
    if (!sb) return NextResponse.json({ error: "Veritabanı bağlantısı yok" }, { status: 503 });

    /* Sahip bilgisi → kullanıcı kendi yayınını sonradan silebilir (RLS delete policy). */
    const { data: { user } } = await sb.auth.getUser();

    const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await sb.from("published_artifacts").insert({
      id,
      user_id: user?.id ?? null,
      title: (typeof title === "string" ? title : "").slice(0, 200) || "Artifact",
      type,
      content,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id });
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const sb = await createClient();
  if (!sb) return NextResponse.json({ error: "Veritabanı bağlantısı yok" }, { status: 503 });

  /* Yalnız herkese açık alanları seç — sahip kimliği (user_id) sızdırma. */
  const { data, error } = await sb
    .from("published_artifacts")
    .select("id, title, type, content, created_at")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Artifact bulunamadı" }, { status: 404 });

  return NextResponse.json(data);
}
