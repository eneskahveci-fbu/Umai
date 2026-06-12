// ── Glob deseniyle dosya yollarını filtreleme ──

/**
 * Bir glob desenini regex'e çevirir.
 * '*' → tek segment, '**' → çoklu segment, '?' → tek karakter.
 */
function globToRegex(pattern: string): RegExp {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // ** : dizinler arası
        re += ".*";
        i += 2;
        // opsiyonel '/'
        if (pattern[i] === "/") {
          re += "/?";
          i++;
        }
      } else {
        re += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      re += "[^/]";
      i++;
    } else if (ch === "." || ch === "(" || ch === ")" || ch === "+" || ch === "^" || ch === "$" || ch === "|" || ch === "{" || ch === "}" || ch === "[" || ch === "]") {
      re += "\\" + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  return new RegExp("^" + re + "$");
}

/**
 * Glob desenine uyan dosya yollarını döndürür.
 */
export function filterByGlob(paths: string[], pattern: string): string[] {
  if (!pattern) return paths;
  const re = globToRegex(pattern);
  return paths.filter((p) => re.test(p));
}
