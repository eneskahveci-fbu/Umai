import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { id, title, messages } = await req.json();
    if (!id || !title || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }
    if (messages.length > 200) {
      return NextResponse.json({ error: "Sohbet çok uzun (max 200 mesaj)" }, { status: 400 });
    }

    const sb = await createClient();
    if (!sb) return NextResponse.json({ error: "Veritabanı bağlantısı yok" }, { status: 503 });

    const shareId = `sh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await sb.from("shared_chats").insert({
      id: shareId,
      title: title.slice(0, 200),
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.slice(0, 8000) : "",
      })),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shareId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const sb = await createClient();
  if (!sb) return NextResponse.json({ error: "Veritabanı bağlantısı yok" }, { status: 503 });

  const { data, error } = await sb.from("shared_chats").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Sohbet bulunamadı" }, { status: 404 });

  return NextResponse.json(data);
}
