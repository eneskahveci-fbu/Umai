/**
 * Proje bağlamı çıkarımı.
 * package.json, tsconfig vb dosyalardan framework/dependency bilgisi toplar.
 */

interface FileEntry {
  path: string;
  content?: string;
}

interface FrameworkInfo {
  name: string;
  version?: string;
  configFiles: string[];
}

export interface ProjectProfile {
  frameworks: FrameworkInfo[];
  lang: string;
  deps: Record<string, string>;
  gitignorePatterns: string[];
}

/**
 * Dosya listesinden kullanılan framework'leri tespit eder.
 */
export function detectFrameworks(files: string[]): FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];
  const fileSet = new Set(files.map((f) => f.replace(/^\/+/, "")));

  // Next.js
  if (fileSet.has("next.config.ts") || fileSet.has("next.config.mjs") || fileSet.has("next.config.js")) {
    frameworks.push({ name: "Next.js", configFiles: ["next.config.*"] });
  }

  // React
  if (
    fileSet.has("package.json") ||
    files.some((f) => f.endsWith(".tsx") || f.endsWith(".jsx"))
  ) {
    if (!frameworks.some((fw) => fw.name === "Next.js")) {
      frameworks.push({ name: "React", configFiles: [] });
    }
  }

  // Tailwind CSS
  if (
    fileSet.has("tailwind.config.ts") ||
    fileSet.has("tailwind.config.mjs") ||
    fileSet.has("tailwind.config.js") ||
    fileSet.has("postcss.config.mjs") ||
    fileSet.has("postcss.config.js")
  ) {
    frameworks.push({ name: "Tailwind CSS", configFiles: ["tailwind.config.*", "postcss.config.*"] });
  }

  // TypeScript
  if (fileSet.has("tsconfig.json")) {
    frameworks.push({ name: "TypeScript", configFiles: ["tsconfig.json"] });
  }

  // Vitest
  if (fileSet.has("vitest.config.ts") || fileSet.has("vitest.config.mts") || fileSet.has("vitest.config.js")) {
    frameworks.push({ name: "Vitest", configFiles: ["vitest.config.*"] });
  }

  // Prisma
  if (files.some((f) => f.includes("prisma/schema.prisma"))) {
    frameworks.push({ name: "Prisma", configFiles: ["prisma/schema.prisma"] });
  }

  // Drizzle
  if (files.some((f) => f.includes("drizzle.config"))) {
    frameworks.push({ name: "Drizzle", configFiles: ["drizzle.config.*"] });
  }

  // ESLint
  if (fileSet.has("eslint.config.mjs") || fileSet.has("eslint.config.js") || fileSet.has(".eslintrc.js")) {
    frameworks.push({ name: "ESLint", configFiles: ["eslint.config.*"] });
  }

  return frameworks;
}

/**
 * package.json içeriğinden bağımlılıkları çıkarır.
 */
export function extractDeps(packageJsonContent: string): Record<string, string> {
  try {
    const pkg = JSON.parse(packageJsonContent);
    const deps: Record<string, string> = {};

    if (pkg.dependencies) Object.assign(deps, pkg.dependencies);
    if (pkg.devDependencies) {
      for (const [k, v] of Object.entries(pkg.devDependencies as Record<string, string>)) {
        deps[`dev:${k}`] = v;
      }
    }

    return deps;
  } catch {
    return {};
  }
}

/**
 * .gitignore içeriğinden kalıpları ayrıştırır.
 * Yorumları ve boş satırları atlar.
 */
export function parseGitignore(content: string): string[] {
  const lines = content.split("\n");
  const patterns: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    patterns.push(line);
  }

  // Her zaman temel kalıpları ekle
  const defaults = ["/node_modules", "/.next", "/out", "/build", "/coverage", ".env*", "!.env.example"];
  for (const d of defaults) {
    if (!patterns.includes(d)) {
      patterns.push(d);
    }
  }

  return patterns;
}
