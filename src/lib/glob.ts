// Glob desen eşleştirme (saf, test edilebilir). Claude Code'un Glob aracı gibi
// yıldızlı desenleri (ör. çift-yıldız + nokta-uzantı) yol eşleştirmesine çevirir.

/** Glob desenini ankor'lu bir RegExp'e çevirir.
    * → tek dizin segmenti (/ hariç), ** → dizinler arası, ? → tek karakter. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++; // '**/' → kök eşleşmesine de izin ver
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

/** Bir yolun glob deseniyle eşleşip eşleşmediği. */
export function matchGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path);
}

/** Yol listesini glob deseniyle filtreler. */
export function filterByGlob(paths: string[], glob: string): string[] {
  const re = globToRegExp(glob);
  return paths.filter((p) => re.test(p));
}
