/* Bulanık (fuzzy) dosya araması — Fuse.js sarmalayıcı.
   Tam alt-dize eşleşmesi gerektirmeden ("apprt" → src/app/api/route.ts)
   alakaya göre sıralı sonuç döndürür. Boş sorguda liste olduğu gibi gelir. */

import Fuse from "fuse.js";

export interface FuzzyFile {
  name: string;
  path: string;
}

/** `items` içinde `query` için bulanık arama yapar; alaka sırasına göre döner. */
export function fuzzyFiles<T extends FuzzyFile>(items: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return items;
  const fuse = new Fuse(items, {
    keys: ["name", "path"],
    threshold: 0.4,
    ignoreLocation: true,
  });
  return fuse.search(q).map((r) => r.item);
}
