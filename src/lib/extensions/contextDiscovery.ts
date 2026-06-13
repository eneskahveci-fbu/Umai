// ---------------------------------------------------------------------------
// CLAUDE.md / AGENTS.md / .rules Otomatik Keşif Motoru
// Bağlı repodaki tüm dosya listesini tarar, davranış kuralları içeren
// dosyaları bulur ve içeriklerini döndürür.
// ---------------------------------------------------------------------------

/* ── Aranacak dosya kalıpları ───────────────────────────────────────────── */
const DISCOVERY_PATTERNS = [
  // Claude Code / Anthropic
  "CLAUDE.md",
  "AGENTS.md",
  // Proje kökü talimatları
  ".rules",
  ".projectrules",
  // Cursor AI
  ".cursorrules",
  ".cursor/rules",
  // GitHub Copilot
  ".github/copilot-instructions.md",
  ".github/instructions.md",
  // Windsurf
  ".windsurfrules",
  // Genel
  ".ai-rules",
  ".aide-rules",
  "CONVENTIONS.md",
] as const;

/* ── Yol normalizasyonu (Windows → POSIX) ──────────────────────────────── */
function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

/* ── Bir yol, kalıplardan biriyle eşleşiyor mu? ────────────────────────── */
function matchesPattern(filePath: string): boolean {
  const n = normalize(filePath).toLowerCase();
  const fileName = n.split("/").pop() || n;
  return DISCOVERY_PATTERNS.some(
    (pattern) => normalize(pattern).toLowerCase() === n || pattern.toLowerCase() === fileName,
  );
}

/* ── Ana keşif fonksiyonu ──────────────────────────────────────────────── */
export interface DiscoveredFile {
  /** Dosyanın repo köküne göre relatif yolu */
  path: string;
  /** Eşleşen kalıbın adı (örn. "CLAUDE.md") */
  matchedPattern: string;
  /** Dosya içeriği (salt metin, binary değil) */
  content: string;
}

/**
 * Tüm dosya yolları arasından CLAUDE.md, .rules vb. dosyaları bulur
 * ve içeriklerini getirir. Bulunan dosyaların içeriğini ayrı ayrı döndürür.
 */
export async function discoverContextFiles(
  allPaths: string[],
  fetchFile: (path: string) => Promise<string>,
): Promise<DiscoveredFile[]> {
  const candidates = allPaths
    .map(normalize)
    .filter(matchesPattern)
    // Yinelenenleri temizle (büyük/küçük harf farkı)
    .filter((p, i, arr) => arr.indexOf(p) === i);

  if (candidates.length === 0) return [];

  const results = await Promise.allSettled(
    candidates.map(async (path) => {
      const content = await fetchFile(path);
      return { path, matchedPattern: findMatchingPattern(path), content };
    }),
  );

  const discovered: DiscoveredFile[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.content.length > 0) {
      discovered.push(r.value);
    }
  }
  return discovered;
}

function findMatchingPattern(filePath: string): string {
  const n = normalize(filePath).toLowerCase();
  for (const pattern of DISCOVERY_PATTERNS) {
    if (normalize(pattern).toLowerCase() === n || pattern.toLowerCase() === (n.split("/").pop() || n)) {
      return pattern;
    }
  }
  return filePath;
}

/* ── Keşfedilen dosyaları sistem prompt'una uygun biçime dönüştürme ────── */
export function formatDiscoveredAsPrompt(files: DiscoveredFile[]): string {
  if (files.length === 0) return "";

  let prompt = "\n[Depoda bulunan davranış kuralları]\n";
  for (const f of files) {
    prompt += `\n--- ${f.path} ---\n${f.content}\n`;
  }
  return prompt;
}
