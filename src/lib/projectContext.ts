/**
 * Proje bağlamı tespiti: framework'leri, bağımlılıkları ve .gitignore kalıplarını çıkarır.
 */

interface ProjectInfo {
  frameworks: string[];
  deps: Record<string, string>;
  gitignorePatterns: string[];
}

export function detectFrameworks(deps: Record<string, string>): string[] {
  const frameworks: string[] = [];

  const depNames = Object.keys(deps);

  if (depNames.some((d) => d === "next" || d === "@next")) frameworks.push("Next.js");
  if (depNames.some((d) => d === "react")) frameworks.push("React");
  if (depNames.some((d) => d === "vue")) frameworks.push("Vue");
  if (depNames.some((d) => d === "svelte") || depNames.some((d) => d === "@sveltejs")) frameworks.push("Svelte");
  if (depNames.some((d) => d === "astro")) frameworks.push("Astro");
  if (depNames.some((d) => d === "tailwindcss")) frameworks.push("Tailwind CSS");
  if (depNames.some((d) => d === "typescript" || d === "tsx" || d === "ts-node")) frameworks.push("TypeScript");
  if (depNames.some((d) => d === "vitest")) frameworks.push("Vitest");
  if (depNames.some((d) => d === "jest")) frameworks.push("Jest");
  if (depNames.some((d) => d === "prisma")) frameworks.push("Prisma");
  if (depNames.some((d) => d === "drizzle-orm")) frameworks.push("Drizzle");
  if (depNames.some((d) => d === "express")) frameworks.push("Express");
  if (depNames.some((d) => d === "fastify")) frameworks.push("Fastify");
  if (depNames.some((d) => d === "nestjs" || d === "@nestjs")) frameworks.push("NestJS");

  return frameworks;
}

export function extractDeps(
  packageJsonContent: string,
): Record<string, string> {
  try {
    const pkg = JSON.parse(packageJsonContent);
    const deps: Record<string, string> = {};

    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      if (typeof version === "string") deps[name] = version;
    }
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      if (typeof version === "string") deps[name] = version;
    }

    return deps;
  } catch {
    return {};
  }
}

export function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}
