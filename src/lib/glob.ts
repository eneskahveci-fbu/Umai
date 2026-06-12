// src/lib/glob.ts — Basit glob deseni eşleştirme (repodaki dosya filtreleme)

/**
 * Glob desenini regex'e çevirir:
 * - `**` → dizinler arası her şey
 * - `*` → tek segment (dizin sınırını aşmaz)
 * - `?` → tek karakter
 */
export function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      // ** → .*
      regexStr += ".*";
      i += 2;
      // /**/ veya sondaki /** hali
      if (pattern[i] === "/") {
        regexStr += "/?";
        i++;
      }
    } else if (pattern[i] === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (pattern[i] === "?") {
      regexStr += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(pattern[i])) {
      regexStr += "\\" + pattern[i];
      i++;
    } else {
      regexStr += pattern[i];
      i++;
    }
  }
  return new RegExp(`^${regexStr}$`);
}

/**
 * Bir glob deseni dosya yoluna uyar mı?
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  return globToRegex(pattern).test(filePath);
}

/**
 * Birden çok glob deseninden herhangi birine uyan dosya var mı?
 */
export function matchesAnyGlob(
  filePath: string,
  patterns: string[],
): boolean {
  return patterns.some((p) => matchesGlob(filePath, p));
}

// basit alternatif: https://www.npmjs.com/package/tiny-glob alternatifi
