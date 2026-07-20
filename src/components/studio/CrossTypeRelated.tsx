"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Link2, ListChecks, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { setSurfaceOpenItem, type Surface } from "@/lib/surfaceNav";
import { useStudioProject } from "@/lib/useStudioProject";
import {
  chatEmbeddingText, docEmbeddingText, formEmbeddingText, notebookEmbeddingText,
  findRelated, withFreshEmbeddings,
} from "@/lib/relatedItems";
import type { CraftDoc, CraftForm, CraftNotebook } from "@/lib/types";

/* Çapraz-tip "İlgili" (Obsidian-lite'ın devamı): DocsStudio'daki tek-tür
   RelatedDocs'un genellemesi — sohbet/doküman/anket/defter arasında arar.
   Her tür kendi embedding önbelleğini (embedding/embeddingVersion alanları)
   korur; bu bileşen yalnız tazeleyip TEK bir havuzda arar. Slayt/Görüntü
   şimdilik kapsam dışı (embedding alanları yok — ayrı bir iş). */

export type RelatedKind = "chat" | "doc" | "form" | "notebook";

const KIND_ICON: Record<RelatedKind, LucideIcon> = {
  chat: MessageSquare, doc: FileText, form: ListChecks, notebook: BookOpen,
};
const KIND_ROUTE: Record<RelatedKind, string> = {
  chat: "", doc: "/studio/dokuman", form: "/studio/anket", notebook: "/studio/defter",
};
/* RelatedKind ("doc"/"form") ile surfaceNav'ın Surface birliği ("docs"/"forms")
   isimleri farklı — küçük bir çeviri tablosu. */
const KIND_SURFACE: Record<Exclude<RelatedKind, "chat">, Surface> = {
  doc: "docs", form: "forms", notebook: "notebook",
};

interface PoolEntry { id: string; kind: RelatedKind; title: string; embedding?: number[] }

export function CrossTypeRelated({ kind, id }: { kind: RelatedKind; id: string }) {
  const router = useRouter();
  const chats = useStore((s) => s.chats);
  const updateChatEmbeddings = useStore((s) => s.updateChatEmbeddings);
  const { saved: docs, saveAll: saveDocs } = useStudioProject<CraftDoc>("craftDocs", 40);
  const { saved: forms, saveAll: saveForms } = useStudioProject<CraftForm>("craftForms", 40);
  const { saved: notebooks, saveAll: saveNotebooks } = useStudioProject<CraftNotebook>("craftNotebooks", 20);

  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [related, setRelated] = useState<{ item: PoolEntry; score: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      const [freshChats, freshDocs, freshForms, freshNbs] = await Promise.all([
        withFreshEmbeddings(chats, chatEmbeddingText),
        withFreshEmbeddings(docs, docEmbeddingText),
        withFreshEmbeddings(forms, formEmbeddingText),
        withFreshEmbeddings(notebooks, notebookEmbeddingText),
      ]);
      if (freshChats.some((c, i) => c !== chats[i])) {
        updateChatEmbeddings(
          freshChats
            .map((c, i) => ({ c, i }))
            .filter(({ c, i }) => c !== chats[i])
            .map(({ c }) => ({ id: c.id, embedding: c.embedding!, embeddingVersion: c.embeddingVersion! }))
        );
      }
      if (freshDocs.some((d, i) => d !== docs[i])) saveDocs(freshDocs);
      if (freshForms.some((f, i) => f !== forms[i])) saveForms(freshForms);
      if (freshNbs.some((n, i) => n !== notebooks[i])) saveNotebooks(freshNbs);
      if (cancelled) return;

      const pool: PoolEntry[] = [
        ...freshChats.filter((c) => !c.incognito).map((c) => ({ id: c.id, kind: "chat" as const, title: c.title, embedding: c.embedding })),
        ...freshDocs.map((d) => ({ id: d.id, kind: "doc" as const, title: d.title, embedding: d.embedding })),
        ...freshForms.map((f) => ({ id: f.id, kind: "form" as const, title: f.title, embedding: f.embedding })),
        ...freshNbs.map((n) => ({ id: n.id, kind: "notebook" as const, title: n.title, embedding: n.embedding })),
      ];
      const target = pool.find((p) => p.kind === kind && p.id === id);
      if (!target?.embedding?.length) { setState("empty"); return; }
      const hits = findRelated(id, target.embedding, pool, 5).filter((h) => h.score > 0.35);
      setRelated(hits);
      setState(hits.length ? "ready" : "empty");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  const openItem = (p: PoolEntry) => {
    if (p.kind === "chat") { useStore.getState().selectChat(p.id); return; }
    setSurfaceOpenItem(KIND_SURFACE[p.kind], p.id);
    router.push(KIND_ROUTE[p.kind]);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1.5">
        <Link2 size={11} /> İlgili
      </div>
      {state === "loading" && <p className="text-[11px] text-muted/40">Aranıyor…</p>}
      {state === "empty" && <p className="text-[11px] text-muted/40">İlgili öğe bulunamadı.</p>}
      {state === "ready" && (
        <div className="space-y-0.5">
          {related.map(({ item, score }) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <button
                key={`${item.kind}:${item.id}`}
                onClick={() => openItem(item)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-muted hover:text-ink hover:bg-bgsoft/60 transition-colors"
              >
                <Icon size={11} className="shrink-0 opacity-40" />
                <span className="flex-1 text-[12.5px] truncate">{item.title}</span>
                <span className="text-[9px] font-mono text-muted/40 shrink-0">{Math.round(score * 100)}%</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
