/* Yerel Anlamsal Hafıza — BM25 + IndexedDB.
   Geçmiş konuşma parçalarını tarayıcı-içi IndexedDB'de saklar ve BM25
   skorlamayla sorgular. Anahtar gerektirmez, sunucuya hiçbir şey gitmez.
   Gate: hasIndexedDB() → SSR-safe, hata atmaz — destek yoksa sessizce
   uykuda kalır (bkz. capabilities.ts). config.memoryEnabled (varsayılan
   false) kapalıyken CoderView bu modülü hiç çağırmaz. */

import { hasIndexedDB } from "./capabilities";
import { tokenize, chunkText } from "./retrieval";

const DB_NAME = "craftai_memory";
const DB_VERSION = 1;
const STORE_NAME = "entries";
const MAX_ENTRIES = 500;
const MIN_CHUNK_LEN = 20;

export interface MemoryEntry {
  id: string;
  content: string;
  sessionId: string;
  timestamp: number;
}

/* BM25 sabitleri (Robertson et al. 1994) */
const K1 = 1.5;
const B_PARAM = 0.75;

/** Saf BM25 puanı — IO yok, test edilebilir. */
export function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDl: number,
  dfMap: Map<string, number>,
  N: number,
): number {
  const dl = docTokens.length;
  if (dl === 0 || queryTokens.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  let score = 0;
  for (const q of queryTokens) {
    const f = tf.get(q) ?? 0;
    if (!f) continue;
    const df = dfMap.get(q) ?? 1;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    const tfNorm = (f * (K1 + 1)) / (f + K1 * (1 - B_PARAM + B_PARAM * (dl / avgDl)));
    score += idf * tfNorm;
  }
  return score;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** İçeriği IndexedDB'ye yazar (parçalara böler, MAX_ENTRIES sınırında en
    eskiler silinir). Fire-and-forget çağrılmak üzere tasarlandı — hata
    atmaz, sohbet akışını asla bloklamaz. */
export async function memoryStore(content: string, sessionId: string): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDB();
    const chunks = chunkText(content, 500).filter((c) => c.trim().length >= MIN_CHUNK_LEN);
    if (!chunks.length) { db.close(); return; }

    const now = Date.now();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const os = tx.objectStore(STORE_NAME);
    for (let i = 0; i < chunks.length; i++) {
      const entry: MemoryEntry = {
        id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        content: chunks[i],
        sessionId,
        timestamp: now + i,
      };
      os.put(entry);
    }
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });

    /* MAX_ENTRIES'i aşınca en eski kayıtları sil. */
    const countReq = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).count();
    const total = await new Promise<number>((res) => { countReq.onsuccess = () => res(countReq.result as number); countReq.onerror = () => res(0); });
    if (total > MAX_ENTRIES) {
      const excess = total - MAX_ENTRIES;
      const idx = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).index("timestamp");
      const cur = idx.openCursor(null, "next");
      let deleted = 0;
      await new Promise<void>((res) => {
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c || deleted >= excess) { res(); return; }
          c.delete();
          deleted++;
          c.continue();
        };
        cur.onerror = () => res();
      });
    }
    db.close();
  } catch {
    /* IndexedDB erişim hatası → sessizce geç */
  }
}

/** BM25 ile en ilgili k geçmiş parçayı döndürür — sistem promptuna enjekte
    edilmek üzere. */
export async function memoryRetrieve(query: string, k = 5): Promise<{ content: string; sessionId: string }[]> {
  if (!hasIndexedDB()) return [];
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  try {
    const db = await openDB();
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    const all: MemoryEntry[] = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result as MemoryEntry[]);
      req.onerror = () => rej(req.error);
    });
    db.close();
    if (!all.length) return [];

    const tokenized = all.map((e) => ({ entry: e, tokens: tokenize(e.content) }));
    const avgDl = tokenized.reduce((s, t) => s + t.tokens.length, 0) / tokenized.length;
    const dfMap = new Map<string, number>();
    for (const { tokens } of tokenized)
      for (const t of new Set(tokens)) dfMap.set(t, (dfMap.get(t) ?? 0) + 1);

    return tokenized
      .map(({ entry, tokens }) => ({
        content: entry.content,
        sessionId: entry.sessionId,
        score: bm25Score(qTokens, tokens, avgDl, dfMap, tokenized.length),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ content, sessionId }) => ({ content, sessionId }));
  } catch {
    return [];
  }
}
