"use client";

/* Projeler — Sidebar'ın eskiden inline gösterdiği katlanır "Projeler"
   akordiyonu artık burada, ayrı bir sayfada (Tem 2026 kullanıcı kararı:
   Claude'un Projects sayfasına paralel — bir proje seçmek kendi "Sohbetler"
   sekmesi olan ProjectModal'ı açar, tıpkı Claude'da bir projeye girip onun
   kendi konuşma listesini görmek gibi). ProjectModal zaten bunu yapıyordu
   (bkz. task #65) — burada yalnızca proje GALERİSİ + oluşturma eklendi. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Folder, FolderPlus, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuthGate, useThemeClasses } from "@/lib/authGate";
import { PROJECT_TEMPLATES, projectColorHex } from "@/lib/constants";
import { ProjectModal } from "@/components/ProjectModal";

export default function ProjectsPage() {
  const auth = useAuthGate();
  useThemeClasses();
  const router = useRouter();

  const chats = useStore((s) => s.chats);
  const config = useStore((s) => s.config);
  const addProject = useStore((s) => s.addProject);
  const addProjectFromTemplate = useStore((s) => s.addProjectFromTemplate);
  const setProjectModalId = useStore((s) => s.setProjectModalId);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const projectCounts = new Map<string, number>();
  for (const c of chats) {
    if (c.incognito || !c.projectId) continue;
    projectCounts.set(c.projectId, (projectCounts.get(c.projectId) ?? 0) + 1);
  }

  if (auth !== "in") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }

  const submitNew = () => {
    const trimmed = name.trim();
    if (trimmed) {
      const id = addProject(trimmed);
      setProjectModalId(id);
    }
    setName("");
    setAdding(false);
  };

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 h-14 border-b border-line bg-bg/90 backdrop-blur">
        <div className="max-w-4xl mx-auto h-full px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => router.push("/app")} className="w-10 h-10 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-bgsoft" title="Çalışma alanına dön" aria-label="Çalışma alanına dön">
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">Projeler</h1>
            <p className="text-[11px] text-muted">{config.projects.length} proje</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand hover:bg-branddim text-[#111110] text-xs font-semibold transition-colors"
          >
            <Plus size={14} /> Yeni proje
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {adding && (
          <div className="mb-5 p-4 rounded-xl border border-brand/30 bg-brand/5 space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
                if (e.key === "Escape") { setAdding(false); setName(""); }
              }}
              placeholder="Proje adı…"
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50 placeholder:text-muted/40"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] text-muted/60 pr-1"><Sparkles size={11} /> Şablon:</span>
              {PROJECT_TEMPLATES.filter((t) => t.id !== "tpl-blank").map((t) => (
                <button
                  key={t.id}
                  onClick={() => { const id = addProjectFromTemplate(t); setAdding(false); setName(""); setProjectModalId(id); }}
                  title={t.description}
                  className="text-[11px] px-2 py-1 rounded-md border border-line/60 text-muted hover:text-ink hover:border-brand/40 transition-colors"
                >
                  {t.icon} {t.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setAdding(false); setName(""); }} className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink transition-colors">İptal</button>
              <button onClick={submitNew} disabled={!name.trim()} className="text-xs px-3.5 py-1.5 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim disabled:opacity-40 transition-colors">Oluştur</button>
            </div>
          </div>
        )}

        {config.projects.length === 0 && !adding ? (
          <div className="text-center py-16 px-3">
            <Folder size={24} className="mx-auto mb-3 text-muted/15" />
            <p className="text-sm text-muted/50 mb-4">Henüz proje yok.</p>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-line hover:border-brand/40 text-muted hover:text-brand transition-colors text-sm"
            >
              <FolderPlus size={15} /> İlk projeni oluştur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {config.projects.map((p) => {
              const accent = projectColorHex(p.color);
              const count = projectCounts.get(p.id) ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => setProjectModalId(p.id)}
                  className="text-left p-4 rounded-xl border border-line bg-surface hover:border-brand/40 hover:bg-bgsoft/40 transition-colors flex flex-col gap-3"
                >
                  <span
                    className="w-10 h-10 rounded-xl grid place-items-center text-lg shrink-0"
                    style={{ background: `${accent}1a`, border: `1px solid ${accent}55` }}
                  >
                    {p.icon || "📁"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{p.name}</span>
                    <span className="block text-[11px] text-muted/60 mt-0.5">
                      {count} sohbet{p.description ? ` · ${p.description}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ProjectModal />
    </main>
  );
}
