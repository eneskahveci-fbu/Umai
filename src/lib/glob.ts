/**
 * Basit glob desen eşleştirme (minimatch olmadan).
 * *, **, ? destekler.
 */

/**
 * Glob desenini regex'e çevirir.
 * *      → tek segmentte herhangi karakter (dosya adı)
 * **     → sıfır veya daha fazla dizin
 * ?      → tek karakter
 * [abc]  → karakter sınıfı
 */
function globToRegex(pattern: string): RegExp {
  let regex = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];
    const next = pattern[i + 1];

    if (ch === "*" && next === "*") {
      // ** → herhangi dizin zinciri
      regex += ".*";
      i += 2;
      // /**/ veya sondaki /**
      if (pattern[i] === "/") {
        regex += "/?";
        i++;
      }
    } else if (ch === "*") {
      regex += "[^/]*";
      i++;
    } else if (ch === "?") {
      regex += "[^/]";
      i++;
    } else if (ch === ".") {
      regex += "\\.";
      i++;
    } else if (ch === "/") {
      regex += "/";
      i++;
    } else {
      // Normal karakter
      regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }

  return new RegExp(`^${regex}$`);
}

/**
 * Dosya yollarını glob desenine göre filtreler.
 * Birden çok desen verilebilir (virgül veya noktalı virgül ile ayrılmış).
 */
export function filterByGlob(paths: string[], pattern: string): string[] {
  if (!pattern || pattern === "*" || pattern === "**") return paths;

  const patterns = pattern
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (patterns.length === 0) return paths;

  const regexes = patterns.map(globToRegex);

  return paths.filter((path) => {
    // Baştaki /'yi kaldır
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return regexes.some((re) => re.test(clean));
  });
}

/**
 * Glob deseni geçerli mi?
 */
export function isValidGlob(pattern: string): boolean {
  if (!pattern || typeof pattern !== "string") return false;
  // Çok uzun desenleri reddet
  if (pattern.length > 200) return false;
  // Geçersiz karakterler
  if (/[\0\n\r]/.test(pattern)) return false;
  return true;
}
