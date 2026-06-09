/* Proje farkındalığı için saf yardımcılar (ağ/yan etki yok → test edilebilir):
   - .gitignore ayrıştırma + basit eşleştirme
   - package.json bağımlılıkları + dosya işaretlerinden framework algılama */

/** .gitignore içeriğini desenlere ayırır (yorum/boş satır atlanır). */
export function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/** Bir yolun .gitignore desenlerinden biriyle eşleşip eşleşmediğini döndürür.
    Desteklenen: birebir, `dir/`, `*.ext`, baştaki `/`, alt dizin eşleşmesi. */
export function isIgnored(path: string, patterns: string[]): boolean {
  const p = path.replace(/^\/+/, "");
  for (const raw of patterns) {
    if (raw.startsWith("!")) continue; // negasyon — basitlik için atla
    let pat = raw.replace(/^\/+/, "");
    const dirOnly = pat.endsWith("/");
    if (dirOnly) pat = pat.slice(0, -1);

    if (pat.startsWith("*.")) {
      const ext = pat.slice(1); // ".ext"
      if (p.endsWith(ext)) return true;
      continue;
    }
    // Yol bileşenlerinden herhangi biri desene eşitse (dizin/dosya adı) eşleş
    const segments = p.split("/");
    if (segments.includes(pat)) return true;
    if (p === pat || p.startsWith(pat + "/")) return true;
  }
  return false;
}

const DEP_FRAMEWORKS: { dep: string; label: string }[] = [
  { dep: "next", label: "Next.js" },
  { dep: "@angular/core", label: "Angular" },
  { dep: "vue", label: "Vue" },
  { dep: "svelte", label: "Svelte" },
  { dep: "@nestjs/core", label: "NestJS" },
  { dep: "express", label: "Express" },
  { dep: "fastify", label: "Fastify" },
  { dep: "react", label: "React" },
  { dep: "vite", label: "Vite" },
  { dep: "tailwindcss", label: "Tailwind CSS" },
  { dep: "vitest", label: "Vitest" },
  { dep: "jest", label: "Jest" },
];

const PATH_FRAMEWORKS: { marker: string; label: string }[] = [
  { marker: "manage.py", label: "Django" },
  { marker: "pyproject.toml", label: "Python (pyproject)" },
  { marker: "requirements.txt", label: "Python" },
  { marker: "Cargo.toml", label: "Rust (Cargo)" },
  { marker: "go.mod", label: "Go" },
  { marker: "pom.xml", label: "Java (Maven)" },
  { marker: "build.gradle", label: "Java/Kotlin (Gradle)" },
  { marker: "Gemfile", label: "Ruby" },
  { marker: "composer.json", label: "PHP (Composer)" },
];

/** package.json bağımlılıkları ve dosya yollarından framework/araç listesi. */
export function detectFrameworks(input: { deps?: Record<string, string>; paths?: string[] }): string[] {
  const found = new Set<string>();
  const deps = input.deps ?? {};
  for (const { dep, label } of DEP_FRAMEWORKS) {
    if (deps[dep]) found.add(label);
  }
  const paths = input.paths ?? [];
  const baseNames = new Set(paths.map((p) => p.split("/").pop() ?? p));
  for (const { marker, label } of PATH_FRAMEWORKS) {
    if (baseNames.has(marker)) found.add(label);
  }
  return [...found];
}

/** package.json metninden { ...deps, ...devDeps } çıkarır (hata toleranslı). */
export function extractDeps(packageJson: string): Record<string, string> {
  try {
    const pkg = JSON.parse(packageJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch {
    return {};
  }
}
