/* Teknik Borç Takipçisi: saf, test edilebilir kod analiz araçları.
   Hiçbir IO yok — sadece string giriş/çıkış. */

/** Döngüsel karmaşıklık kategorisi. */
export type ComplexityRating = "iyi" | "orta" | "karmaşık";

export interface ComplexityResult {
  score: number;
  rating: ComplexityRating;
}

/** Döngüsel karmaşıklık (McCabe): karar noktaları sayısı + 1.
 *  Dil bağımsız regex yaklaşımı (JS/TS/Python/Go uyumlu). */
export function cyclomaticComplexity(code: string): ComplexityResult {
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bdo\b\s*\{/g,
    /\bcase\b\s+[^:]+:/g,
    /\bcatch\b/g,
    /\?\?/g,
    /\?\./g,
    /&&/g,
    /\|\|/g,
    /\?[^?:.>]/g, // ternary (? not followed by . ? : >)
  ];
  let score = 1;
  for (const p of patterns) score += (code.match(p) ?? []).length;
  const rating: ComplexityRating = score <= 5 ? "iyi" : score <= 10 ? "orta" : "karmaşık";
  return { score, rating };
}

/** Export edilen fonksiyonlarda JSDoc yorumu eksik olanları döndürür.
 *  İsimler: `export function foo`, `export const foo = (`, `export async function foo`. */
export function missingJsdoc(code: string): string[] {
  const lines = code.split("\n");
  const missing: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const exportMatch = line.match(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/);
    if (!exportMatch) continue;
    const name = exportMatch[1];
    // JSDoc önceki satırlarda (en çok 3 satır önce)
    let hasJsdoc = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (/\/\*\*/.test(lines[j])) { hasJsdoc = true; break; }
    }
    if (!hasJsdoc) missing.push(name);
  }
  return missing;
}

/** Verilen fonksiyon imzası için AI'ya gönderilecek JSDoc prompt'u üretir. */
export function generateJsdocPrompt(funcSignature: string): string {
  return (
    `Aşağıdaki TypeScript fonksiyon imzası için kısa, bilgilendirici bir JSDoc yorumu yaz.\n` +
    `Yalnızca JSDoc bloğunu döndür (/** ... */ içinde), başka hiçbir şey yazma.\n\n` +
    `\`\`\`ts\n${funcSignature}\n\`\`\``
  );
}

export interface DuplicateBlock {
  hash: string;
  lines: string[];
  occurrences: number;
}

/** Basit hash-tabanlı blok benzerliği: ardışık BLOCK_SIZE satırları karşılaştırır. */
export function detectDuplicates(code: string, blockSize = 5): DuplicateBlock[] {
  const lines = code.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const seen = new Map<string, { lines: string[]; count: number }>();
  for (let i = 0; i <= lines.length - blockSize; i++) {
    const block = lines.slice(i, i + blockSize);
    const key = block.join("\n");
    if (key.trim().length < 30) continue; // çok kısa blokları atla
    const existing = seen.get(key);
    if (existing) existing.count++;
    else seen.set(key, { lines: block, count: 1 });
  }
  return Array.from(seen.entries())
    .filter(([, v]) => v.count > 1)
    .map(([hash, v]) => ({ hash, lines: v.lines, occurrences: v.count }));
}

/** Bir dosyayı analiz eder ve özet rapor döndürür. */
export interface FileAnalysis {
  path: string;
  complexity: ComplexityResult;
  missingJsdocFunctions: string[];
  duplicateBlocks: DuplicateBlock[];
}

export function analyzeFile(path: string, code: string): FileAnalysis {
  return {
    path,
    complexity: cyclomaticComplexity(code),
    missingJsdocFunctions: missingJsdoc(code),
    duplicateBlocks: detectDuplicates(code),
  };
}
