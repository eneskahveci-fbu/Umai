"use client";

import { ArrowLeft, BookOpen, FileText, Images, LayoutPanelTop, ListChecks, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuthGate, useThemeClasses } from "@/lib/authGate";

type Tab = "all" | "media" | "design" | "docs" | "forms" | "notebooks";

const tabs: { id: Tab; label: string; icon: typeof Images }[] = [
  { id: "all", label: "Tümü", icon: LayoutPanelTop },
  { id: "media", label: "Medya", icon: Images },
  { id: "design", label: "Tasarım", icon: LayoutPanelTop },
  { id: "docs", label: "Doküman", icon: FileText },
  { id: "forms", label: "Anket", icon: ListChecks },
  { id: "notebooks", label: "Defter", icon: BookOpen },
];

export default function LibraryPage() {
  /* /studio ve /app ile AYNI giriş kapısı (tutarlılık) + tema sınıfları
     (koyu/açık tercihi bu bağımsız rotada da uygulansın). */
  const auth = useAuthGate();
  useThemeClasses();
  const router = useRouter();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const [tab, setTab] = useState<Tab>("all");
  const media = useMemo(() => [...(config.mediaAssets ?? [])].sort((a, b) => b.createdAt - a.createdAt), [config.mediaAssets]);
  const show = (kind: Tab) => tab === "all" || tab === kind;

  if (auth !== "in") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }

  const sendToConverter = (url: string) => {
    try { sessionStorage.setItem("umai_converter_source", url); } catch { /* yok say */ }
    router.push("/tools/converter");
  };

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 h-14 border-b border-line bg-bg/90 backdrop-blur">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => router.push("/app")} className="w-10 h-10 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-bgsoft" title="Çalışma alanına dön" aria-label="Çalışma alanına dön"><ArrowLeft size={17} /></button>
          <div className="min-w-0"><h1 className="text-sm font-semibold">Kütüphane</h1><p className="text-[11px] text-muted">Ürettiğin tüm çıktılar tek yerde</p></div>
          <button onClick={() => router.push("/tools/converter")} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-xs font-semibold hover:border-brand/50 hover:bg-bgsoft"><Wrench size={14} /> Dönüştürücü</button>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex gap-1 overflow-x-auto border-b border-line mb-6" role="tablist" aria-label="Kütüphane türleri">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${tab === item.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}><item.icon size={14} />{item.label}</button>)}
        </div>

        {show("media") && <section className="mb-10"><SectionHead title="Medya" count={media.length} empty="Henüz görsel yok. Sohbette /gorsel ile üret veya dosya dönüştür." />
          {media.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{media.map((asset) => <article key={asset.id} className="border border-line bg-surface rounded-lg overflow-hidden group"><img src={asset.url} alt={asset.title} className="aspect-square w-full object-cover bg-bgsoft" /><div className="p-2"><p className="text-xs font-medium truncate" title={asset.title}>{asset.title}</p><p className="text-[10px] text-muted mt-0.5">{new Date(asset.createdAt).toLocaleDateString("tr-TR")}</p><div className="flex gap-1 mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><button onClick={() => sendToConverter(asset.url)} className="flex-1 text-[10px] py-1 rounded border border-line hover:border-brand/50">Dönüştür</button><button onClick={() => saveConfig({ ...config, mediaAssets: media.filter((x) => x.id !== asset.id) })} className="text-[10px] px-1.5 text-red hover:bg-red/10 rounded" aria-label="Görseli sil">Sil</button></div></div></article>)}</div>}
        </section>}

        {show("design") && <section className="mb-10"><SectionHead title="Tasarım ve artifact'ler" count={config.studioProjects?.length ?? 0} empty="Stüdyo'da oluşturduğun tasarımlar burada görünür." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{(config.studioProjects ?? []).map((item) => <LibraryCard key={item.id} title={item.name} meta={item.artifactType ?? "html"} onOpen={() => router.push("/studio")} />)}</div>
        </section>}
        {show("docs") && <section className="mb-10"><SectionHead title="Dokümanlar" count={config.craftDocs?.length ?? 0} empty="Doküman Stüdyosu'nda oluşturduğun belgeler burada görünür." /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{(config.craftDocs ?? []).map((item) => <LibraryCard key={item.id} title={item.title} meta={`${item.blocks.length} blok`} onOpen={() => router.push("/studio/dokuman")} />)}</div></section>}
        {show("forms") && <section className="mb-10"><SectionHead title="Anketler" count={config.craftForms?.length ?? 0} empty="Anket Stüdyosu'nda oluşturduğun formlar burada görünür." /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{(config.craftForms ?? []).map((item) => <LibraryCard key={item.id} title={item.title} meta={`${item.questions.length} soru`} onOpen={() => router.push("/studio/anket")} />)}</div></section>}
        {show("notebooks") && <section className="mb-10"><SectionHead title="Defterler" count={config.craftNotebooks?.length ?? 0} empty="Kaynak temelli defterlerin burada görünür." /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{(config.craftNotebooks ?? []).map((item) => <LibraryCard key={item.id} title={item.title} meta={`${item.sources.length} kaynak`} onOpen={() => router.push("/studio/defter")} />)}</div></section>}
      </div>
    </main>
  );
}

function SectionHead({ title, count, empty }: { title: string; count: number; empty: string }) { return <div className="mb-3"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{title}</h2><span className="text-[11px] text-muted">{count}</span></div>{count === 0 && <p className="text-xs text-muted mt-2">{empty}</p>}</div>; }
function LibraryCard({ title, meta, onOpen }: { title: string; meta: string; onOpen: () => void }) { return <button onClick={onOpen} className="text-left border border-line bg-surface rounded-lg p-3 hover:border-brand/50 hover:bg-bgsoft transition-colors"><p className="text-sm font-medium truncate">{title}</p><p className="text-xs text-muted mt-1">{meta}</p></button>; }
