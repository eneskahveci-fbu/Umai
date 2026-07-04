import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";
import type { Artifact } from "@/lib/types";
import { buildArtifactSrcDoc } from "@/lib/artifactDoc";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sb = await createClient();
  if (!sb) return { title: "Yayınlanan Artifact" };
  const { data } = await sb.from("published_artifacts").select("title").eq("id", id).single();
  return { title: data?.title ? `${data.title} — Craft` : "Yayınlanan Artifact — Craft" };
}

export default async function PublishedArtifactPage({ params }: Props) {
  const { id } = await params;
  const sb = await createClient();
  if (!sb) return <ErrorPage message="Veritabanı bağlantısı kurulamadı." />;

  const { data, error } = await sb
    .from("published_artifacts")
    .select("id, title, type, content, created_at")
    .eq("id", id)
    .single();

  if (error || !data) return <ErrorPage message="Bu artifact bulunamadı veya silinmiş." />;

  const type = (["html", "svg", "mermaid"].includes(data.type) ? data.type : "html") as Artifact["type"];
  const srcdoc = buildArtifactSrcDoc(type, data.content ?? "");
  const date = new Date(data.created_at).toLocaleString("tr-TR");

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink font-sans">
      <nav className="sticky top-0 z-50 backdrop-blur bg-bg/80 border-b border-line/60 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg min-w-0">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#c8a87e" fillOpacity="0.1"/><path d="M14 5L22 10.5V17.5L14 23L6 17.5V10.5L14 5Z" stroke="#c8a87e" strokeWidth="1.6" strokeLinejoin="round" fill="none"/><circle cx="14" cy="14" r="2.8" fill="#c8a87e" fillOpacity="0.85"/></svg>
            <span className="text-ink">Craft</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-muted truncate hidden sm:block">{data.title}</span>
            <Link href={`/app?remix=${data.id}`} className="text-xs px-3 py-1.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold transition-colors shrink-0">
              ⚡ Remix Et
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 sm:px-6 py-2 text-xs text-muted/70 max-w-6xl mx-auto w-full">
          {date} tarihinde yayınlandı · Craft
        </div>
        <div className="flex-1 min-h-0 bg-white">
          <iframe
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-modals"
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
            title={data.title || "Yayınlanan artifact"}
          />
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
