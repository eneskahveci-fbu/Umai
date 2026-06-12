/**
 * Glob deseni ile dosya filtreleme.
 * Desteklenen: * (tek segment), ** (dizinler arası), ? (tek karakter)
 */
export function filterByGlob(paths: string[], pattern: string): string[] {
  const regex = globToRegex(pattern);
  return paths.filter((p) => regex.test(p));
}

function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // ** — dizinler arası
        if (pattern[i + 2] === "/") {
          regexStr += "(.*/)?";
          i += 3;
          continue;
        }
        regexStr += ".*";
        i += 2;
        continue;
      }
      // * — tek segment içinde
      regexStr += "[^/]*";
      i++;
      continue;
    }

    if (ch === "?") {
      regexStr += "[^/]";
      i++;
      continue;
    }

    // Özel regex karakterlerini escape et
    if ("\\^$.[]{}()+|".includes(ch)) {
      regexStr += "\\" + ch;
    } else {
      regexStr += ch;
    }
    i++;
  }

  return new RegExp(`^${regexStr}$`);
}
