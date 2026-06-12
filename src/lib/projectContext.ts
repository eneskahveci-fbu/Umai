// src/lib/projectContext.ts — Proje bağlamı çıkarma (SOUL.md, .rules, package.json)

/**
 * Bir repodaki proje profilini çıkar.
 * Algılanan teknolojileri, .gitignore kalıplarını,
 * Next.js agent kurallarını derler.
 */
export interface ProjectProfile {
  technologies: string[];
  gitignorePatterns: string[];
  hasNextJsAgentRules: boolean;
  soulMd: string;
  workspaceRules: string;
}

const TECH_INDICATORS: Record<string, string[]> = {
  nextjs: ["next.config.", "next-env.d.ts", "app/layout.tsx", "app/page.tsx"],
  react: ["react", "react-dom"],
  tailwind: ["tailwind.config", "postcss.config", "@tailwindcss"],
  vitest: ["vitest.config", "vitest"],
  typescript: ["tsconfig.json", "typescript"],
  prisma: ["prisma/schema.prisma", "@prisma/client"],
  trpc: ["@trpc"],
  zustand: ["zustand"],
};

export function detectTechnologies(files: string[], packageJson?: Record<string, unknown>): string[] {
  const techs = new Set<string>();

  // Dosya isimlerinden tespit
  for (const file of files) {
    for (const [tech, indicators] of Object.entries(TECH_INDICATORS)) {
      if (indicators.some((ind) => file.includes(ind))) {
        techs.add(tech);
      }
    }
  }

  // package.json'dan tespit
  if (packageJson) {
    const deps = {
      ...((packageJson.dependencies as Record<string, string>) ?? {}),
      ...((packageJson.devDependencies as Record<string, string>) ?? {}),
    };
    for (const dep of Object.keys(deps)) {
      for (const [tech, indicators] of Object.entries(TECH_INDICATORS)) {
        if (indicators.includes(dep)) {
          techs.add(tech);
        }
      }
    }
    if (deps["typescript"]) techs.add("typescript");
  }

  return [...techs];
}

const DEFAULT_GITIGNORE = [
  "/node_modules",
  "/.next/",
  "/out/",
  "/build",
  ".DS_Store",
  "*.pem",
  ".env*",
  "!.env.example",
  ".vercel",
  "*.tsbuildinfo",
  "next-env.d.ts",
];

export function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function buildProjectContext(profile: ProjectProfile): string {
  const parts: string[] = [];

  parts.push("[Proje profili]");
  parts.push(
    `• Algılanan teknolojiler: ${profile.technologies.join(", ")} — bu ekosistemin en iyi pratiklerini uygula.`,
  );

  if (profile.gitignorePatterns.length > 0) {
    parts.push(
      `• .gitignore kalıpları (bunlara dokunma/oluşturma): ${profile.gitignorePatterns.join(", ")}`,
    );
  }

  if (profile.hasNextJsAgentRules) {
    parts.push(
      "[Ajan modu — Next.js agent kuralları geçerli]",
    );
  }

  if (profile.soulMd) {
    parts.push(`[SOUL.md]:\n${profile.soulMd}`);
  }

  return parts.join("\n");
}

export function getDefaultGitignorePatterns(): string[] {
  return [...DEFAULT_GITIGNORE];
}
