import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sb = await createClient();
  if (!sb) return { title: "Paylaşılan Sohbet" };
  const { data } = await sb.from("shared_chats").select("title").eq("id", id).single();
  return { title: data?.title ? `${data.title} — Craft.Coder` : "Paylaşılan Sohbet — Craft.Coder" };
}

export default async function SharedChatPage({ params }: Props) {
  const { id } = await params;
  const sb = await createClient();

  if (!sb) {
    return <ErrorPage message="Veritabanı bağlantısı kurulamadı." />;
  }

  const { data, error } = await sb.from("shared_chats").select("*").eq("id", id).single();

  if (error || !data) {
    return <ErrorPage message="Bu sohbet bulunamadı veya silinmiş." />;
  }

  const messages: { role: string; content: string }[] = data.messages ?? [];
  const date = new Date(data.created_at).toLocaleString("tr-TR");

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <nav className="sticky top-0 z-50 backdrop-blur bg-bg/80 border-b border-line/60">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#c8a87e" fillOpacity="0.1"/><path d="M14 5L22 10.5V17.5L14 23L6 17.5V10.5L14 5Z" stroke="#c8a87e" strokeWidth="1.6" strokeLinejoin="round" fill="none"/><circle cx="14" cy="14" r="2.8" fill="#c8a87e" fillOpacity="0.85"/></svg>
            <span className="text-ink">Craft</span><span className="brand-text">.Coder</span>
          </Link>
          <Link href="/app" className="text-xs px-3 py-1.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold transition-colors">
            Uygulamayı Aç
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-extrabold mb-1">{data.title}</h1>
        <p className="text-xs text-muted mb-8">{date} tarihinde paylaşıldı · {messages.length} mesaj</p>

        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={i} className={`rounded-2xl px-5 py-4 ${m.role === "user" ? "bg-brand/10 border border-brand/20" : "bg-surface border border-line/60"}`}>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-muted/60">
                {m.role === "user" ? "Kullanıcı" : "Craft.Coder"}
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{m.content}</pre>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/app" className="inline-flex items-center gap-2 bg-brand hover:bg-branddim text-white font-semibold px-6 py-3 rounded-2xl transition-colors">
            ⚡ Craft.Coder ile kendi sohbetini başlat
          </Link>
        </div>
      </main>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center gap-4">
      <div className="text-4xl">🔗</div>
      <p className="text-muted">{message}</p>
      <Link href="/" className="text-brand hover:underline text-sm">Ana sayfaya dön</Link>
    </div>
  );
}
