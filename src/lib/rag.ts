/* Tarayıcı içi anlamsal (semantic) arama — transformers.js gömme (embedding)
   modeli. Depo dosyalarını/parçalarını vektöre çevirip kosinüs benzerliğiyle
   bir sorguya en alakalı parçaları bulur (kelime eşleşmesi değil, ANLAM).

   Model (all-MiniLM-L6-v2, ~25MB quantize) ilk kullanımda TEMBEL indirilir ve
   tarayıcıda (WASM/WebGPU) çalışır; hiçbir veri sunucuya gitmez. Yüklenemezse
   tüm fonksiyonlar zarifçe boş/sıralanmamış döner. */

type FeatureExtractor = (
  text: string | string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let extractorPromise: Promise<FeatureExtractor | null> | null = null;

async function getExtractor(): Promise<FeatureExtractor | null> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const { pipeline, env } = await import("@huggingface/transformers");
        /* Yalnızca uzak (HF Hub) modeller; yerel dosya sistemi arama. */
        env.allowLocalModels = false;
        const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
          dtype: "q8",
        });
        return pipe as unknown as FeatureExtractor;
      } catch {
        return null;
      }
    })();
  }
  return extractorPromise;
}

/** Modelin yüklenip yüklenemeyeceğini denemeden, kabaca destekleniyor mu? */
export function ragSupported(): boolean {
  return typeof window !== "undefined";
}

/** Metinleri normalize edilmiş gömme vektörlerine çevirir (sırayı korur).
    Model yoksa boş dizi döner. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const extractor = await getExtractor();
  if (!extractor) return [];
  try {
    const out = await extractor(texts, { pooling: "mean", normalize: true });
    return out.tolist();
  } catch {
    return [];
  }
}

/** Normalize vektörlerde kosinüs benzerliği = nokta çarpımı. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export interface RagChunk {
  path: string;
  text: string;
  /** Parçanın dosyadaki başlangıç satırı (1 tabanlı), gösterim için. */
  line: number;
}

export interface RagHit extends RagChunk {
  score: number;
}

/** Bir metni ~maxChars'lık satır-hizalı parçalara böler (RAG için). */
export function chunkText(path: string, content: string, maxChars = 1200): RagChunk[] {
  const lines = content.split("\n");
  const chunks: RagChunk[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  let startLine = 1;
  lines.forEach((ln, i) => {
    buf.push(ln);
    bufLen += ln.length + 1;
    if (bufLen >= maxChars) {
      chunks.push({ path, text: buf.join("\n"), line: startLine });
      buf = [];
      bufLen = 0;
      startLine = i + 2;
    }
  });
  if (buf.length && buf.join("").trim()) {
    chunks.push({ path, text: buf.join("\n"), line: startLine });
  }
  return chunks;
}

/* Bellekteki anlamsal indeks. Parçalar + vektörleri tutar; sorguyla sıralar.
   İndeksleme pahalı olduğundan çağıran tarafça (repo+branch ile) önbelleklenir. */
export class SemanticIndex {
  private chunks: RagChunk[] = [];
  private vectors: number[][] = [];

  get size(): number {
    return this.chunks.length;
  }

  /** Parçaları gömüp indekse ekler. Toplu (batch) gömme yapılır. */
  async add(chunks: RagChunk[]): Promise<void> {
    if (!chunks.length) return;
    const vecs = await embed(chunks.map((c) => c.text));
    if (vecs.length !== chunks.length) return; /* gömme başarısız → atla */
    this.chunks.push(...chunks);
    this.vectors.push(...vecs);
  }

  /** Sorguya en alakalı parçaları (azalan skorla) döndürür. */
  async search(query: string, topK = 6): Promise<RagHit[]> {
    if (!this.chunks.length) return [];
    const [qv] = await embed([query]);
    if (!qv) return [];
    return this.chunks
      .map((c, i) => ({ ...c, score: cosine(qv, this.vectors[i]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
