/* "İlgili" (Obsidian-lite) — sohbetler/dokümanlar arasında otomatik anlamsal
   bağlantı. rag.ts'in embed()/cosine() ilkelleri üzerine kurulu: tamamen
   istemci tarafında çalışır (WASM/WebGPU), sunucuya veri gitmez, yeni bir
   Supabase tablosu/RLS gerektirmez. Vektörler hesaplanınca öğenin kendi
   kaydına önbelleklenir (embedding + embeddingVersion alanları) — içerik
   değişmediği sürece yeniden hesaplanmaz. Grafik görselleştirme kasıtlı
   olarak YOK (v1 kapsamı: küçük bir "İlgili" liste). */
import { cosine, embed } from "./rag";

export interface Related<T> {
  item: T;
  score: number;
}

function clip(text: string, maxChars = 2000): string {
  const t = text.trim();
  return t.length > maxChars ? t.slice(0, maxChars) : t;
}

export function chatEmbeddingText(c: { title: string; messages: { content: unknown }[] }): string {
  const recent = c.messages
    .slice(-6)
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter(Boolean)
    .join("\n");
  return clip(`${c.title}\n${recent}`);
}

export function docEmbeddingText(d: { title: string; blocks: { text: string }[] }): string {
  const text = d.blocks.map((b) => b.text).filter(Boolean).join("\n");
  return clip(`${d.title}\n${text}`);
}

export function formEmbeddingText(f: { title: string; desc?: string; questions: { label: string }[] }): string {
  const text = f.questions.map((q) => q.label).filter(Boolean).join("\n");
  return clip(`${f.title}\n${f.desc ?? ""}\n${text}`);
}

export function notebookEmbeddingText(n: { title: string; sources: { name: string; text: string }[] }): string {
  const text = n.sources.map((s) => `${s.name}\n${s.text}`).filter(Boolean).join("\n");
  return clip(`${n.title}\n${text}`);
}

/** Eksik/bayat gömmeleri toplu (tek embed() çağrısı) hesaplar. `versionOf` içerik
    değiştiğinde artan bir sayı (ör. mesaj/blok sayısı) döndürmeli — güncel
    öğelere DOKUNULMAZ (aynı referans korunur), yalnız bayat/eksik olanlar
    yeni referansla değiştirilir. Gömme modeli yüklenemezse dizi olduğu gibi
    döner (zarif düşüş — rag.ts'in kendi deseniyle tutarlı). */
export async function withFreshEmbeddings<T extends { embedding?: number[]; embeddingVersion?: number }>(
  items: T[],
  versionOf: (item: T) => number,
  textOf: (item: T) => string,
): Promise<T[]> {
  const stale = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.embedding?.length || item.embeddingVersion !== versionOf(item));
  if (!stale.length) return items;

  const vectors = await embed(stale.map(({ item }) => textOf(item) || " "));
  if (vectors.length !== stale.length) return items;

  const next = [...items];
  stale.forEach(({ item, i }, k) => {
    next[i] = { ...item, embedding: vectors[k], embeddingVersion: versionOf(item) };
  });
  return next;
}

/** Hedefe (kendisi hariç) en alakalı ilk topK öğeyi azalan skorla döndürür. */
export function findRelated<T extends { id: string; embedding?: number[] }>(
  targetId: string,
  targetEmbedding: number[],
  candidates: T[],
  topK = 5,
): Related<T>[] {
  return candidates
    .filter((c) => c.id !== targetId && c.embedding?.length)
    .map((c) => ({ item: c, score: cosine(targetEmbedding, c.embedding!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
