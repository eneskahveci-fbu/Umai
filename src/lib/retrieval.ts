/* Hafif RAG (gömme/embedding YOK, anahtarsız, ücretsiz) — proje bilgi tabanı
   büyük olduğunda tüm dosyaları bağlama gömmek yerine, kullanıcının sorusuna en
   ilgili PARÇALARI TF-IDF benzeri sözcüksel skorla getirir. Saf fonksiyon →
   birim testlerle doğrulanır. */

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || []);
}

/** Metni ~size karakterlik, paragraf sınırlarına saygılı parçalara böler. */
export function chunkText(text: string, size = 700): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of text.split(/\n{2,}/)) {
    if (cur && (cur.length + 2 + p.length) > size) { out.push(cur); cur = p; }
    else cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > size * 1.8) { out.push(cur.slice(0, size)); cur = cur.slice(size); }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export interface RetrievalDoc { name: string; content: string; }

/** Soruya en ilgili parçaları döndürür (TF-IDF). Eşleşme yoksa boş. */
export function retrieve(query: string, docs: RetrievalDoc[], k = 6): { name: string; chunk: string }[] {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];

  const items: { name: string; chunk: string; tokens: string[] }[] = [];
  for (const d of docs) for (const c of chunkText(d.content)) items.push({ name: d.name, chunk: c, tokens: tokenize(c) });
  if (!items.length) return [];

  const df = new Map<string, number>();
  for (const it of items) for (const t of new Set(it.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = items.length;

  return items
    .map((it) => {
      const tf = new Map<string, number>();
      for (const t of it.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      for (const q of qTokens) {
        const f = tf.get(q) ?? 0;
        if (f) score += (1 + Math.log(f)) * Math.log(1 + N / (df.get(q) ?? 1));
      }
      return { name: it.name, chunk: it.chunk, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ name, chunk }) => ({ name, chunk }));
}
