// ── Proje bağlamı: framework algılama, bağımlılık çıkarma, .gitignore ayrıştırma ──

export interface ProjectContext {
  frameworks: string[];
  deps: Record<string, string>;
  gitignorePatterns: string[];
}

/**
 * Dosya adlarına ve içeriklere bakarak framework'leri algılar.
 */
export function detectFrameworks(files: { path: string; content?: string }[]): string[] {
  const paths = files.map((f) => f.path.toLowerCase());
  const detected: string[] = [];

  if (paths.some((p) => p === "package.json")) detected.push("Node.js");
  if (paths.some((p) => p.includes("next.config"))) detected.push("Next.js");
  if (paths.some((p) => p.includes("vite.config"))) detected.push("Vite");
  if (paths.some((p) => p.includes("tailwind.config") || p.includes("tailwind"))) detected.push("Tailwind CSS");
  if (paths.some((p) => p.endsWith(".tsx") || p.endsWith(".ts"))) detected.push("TypeScript");
  if (paths.some((p) => p.endsWith(".jsx") || p.endsWith(".js"))) detected.push("JavaScript");
  if (paths.some((p) => p === "go.mod")) detected.push("Go");
  if (paths.some((p) => p === "cargo.toml")) detected.push("Rust");
  if (paths.some((p) => p === "requirements.txt" || p === "pyproject.toml")) detected.push("Python");
  if (paths.some((p) => p === "gemfile")) detected.push("Ruby");
  if (paths.some((p) => p === "composer.json")) detected.push("PHP");
  if (paths.some((p) => p.includes("docker"))) detected.push("Docker");
  if (paths.some((p) => p === ".github/workflows" || p.startsWith(".github/workflows/")))
    detected.push("GitHub Actions");
  if (paths.some((p) => p.includes(".gitlab-ci"))) detected.push("GitLab CI");
  if (paths.some((p) => p.includes("vitest") || p.includes("jest.config"))) detected.push("Test (Vitest/Jest)");
  if (paths.some((p) => p.includes("playwright.config"))) detected.push("Playwright");

  return [...new Set(detected)];
}

/**
 * package.json içeriğinden bağımlılıkları çıkarır.
 */
export function extractDeps(packageJsonContent: string): Record<string, string> {
  try {
    const pkg = JSON.parse(packageJsonContent) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
  } catch {
    return {};
  }
}

/**
 * .gitignore içeriğini satırlara böler, yorum ve boş satırları atlar.
 */
export function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}
