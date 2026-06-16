/* Tarayıcı içi kod biçimlendirme — Prettier standalone.
   Bundle'ı şişirmemek için parser eklentileri yalnızca gerektiğinde TEMBEL
   yüklenir. Desteklenmeyen dilde girdi olduğu gibi döner (sessiz). */

/** Monaco dil kimliğini Prettier parser'ına eşler. null ⇒ desteklenmiyor. */
function parserFor(language: string): string | null {
  switch (language) {
    case "typescript":
    case "javascript":
    case "tsx":
    case "jsx":
      return "babel-ts";
    case "json":
      return "json";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "html":
      return "html";
    case "markdown":
      return "markdown";
    case "yaml":
      return "yaml";
    default:
      return null;
  }
}

/** Bu dil Prettier ile biçimlendirilebilir mi? */
export function canFormat(language: string): boolean {
  return parserFor(language) !== null;
}

/** Kodu biçimlendirir. Desteklenmeyen dil/başarısızlıkta orijinali döndürür. */
export async function formatCode(code: string, language: string): Promise<string> {
  const parser = parserFor(language);
  if (!parser) return code;
  try {
    const prettier = await import("prettier/standalone");
    const plugins: import("prettier").Plugin[] = [];
    if (parser === "babel-ts") {
      plugins.push(
        (await import("prettier/plugins/babel")).default,
        (await import("prettier/plugins/estree")).default,
      );
    } else if (parser === "json") {
      plugins.push(
        (await import("prettier/plugins/babel")).default,
        (await import("prettier/plugins/estree")).default,
      );
    } else if (parser === "css") {
      plugins.push((await import("prettier/plugins/postcss")).default);
    } else if (parser === "html") {
      plugins.push((await import("prettier/plugins/html")).default);
    } else if (parser === "markdown") {
      plugins.push((await import("prettier/plugins/markdown")).default);
    } else if (parser === "yaml") {
      plugins.push((await import("prettier/plugins/yaml")).default);
    }
    return await prettier.format(code, {
      parser,
      plugins,
      tabWidth: 2,
      semi: true,
      singleQuote: false,
    });
  } catch {
    return code;
  }
}
