import { describe, expect, it } from "vitest";
import { parseDesignMd, parseSkillMd, looksLikeSkillMd } from "../odFormat";

const DESIGN = `# Warm Editorial
> Category: Starter

## Visual Theme & Atmosphere
Sıcak, dergisel.

## Color Palette & Roles
- **Background:** \`#FAF6EF\`
- **Accent:** \`#C4622D\`
`;

const SKILL = `---
name: saas-landing
description: |
  Build a marketing landing page. Triggers: saas landing, hero.
od:
  mode: prototype
  example_prompt: "Landing for a CRM"
---
# Workflow
1. Hero kur.
`;

describe("parseDesignMd", () => {
  it("başlık, kategori ve accent hex'ini çıkarır", () => {
    const d = parseDesignMd(DESIGN);
    expect(d.name).toBe("Warm Editorial");
    expect(d.category).toBe("Starter");
    expect(d.accent.toLowerCase()).toBe("#c4622d");
    expect(d.designMd).toContain("## Color Palette");
  });
  it("eksik alanlarda güvenli varsayılanlar", () => {
    const d = parseDesignMd("içerik yalnız");
    expect(d.name).toBe("İçe aktarılan sistem");
    expect(d.accent).toBe("#c8a87e");
  });
});

describe("parseSkillMd", () => {
  it("frontmatter alanlarını ve gövdeyi ayırır", () => {
    const s = parseSkillMd(SKILL)!;
    expect(s.name).toBe("saas-landing");
    expect(s.description).toContain("marketing landing");
    expect(s.mode).toBe("prototype");
    expect(s.examplePrompt).toBe("Landing for a CRM");
    expect(s.body.startsWith("# Workflow")).toBe(true);
  });
  it("frontmatter yoksa null", () => {
    expect(parseSkillMd("# düz markdown")).toBe(null);
  });
  it("looksLikeSkillMd doğru ayırt eder", () => {
    expect(looksLikeSkillMd(SKILL)).toBe(true);
    expect(looksLikeSkillMd(DESIGN)).toBe(false);
  });
});
