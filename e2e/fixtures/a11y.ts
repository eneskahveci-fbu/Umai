import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/* Sayfadaki WCAG ihlallerini axe-core ile tarar. Yalnız "serious"/"critical"
   etkili ihlallerde test düşer — "minor"/"moderate" bulgular (ör. renk
   kontrastı sınır durumları) gürültü yaratmasın, ama gerçek engelleyici
   sorunlar (eksik erişilebilir isim, focus tuzağı yok vb.) sessizce geri
   gelmesin diye CI'da kalıcı bir kapı olur. */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} öğe\n  ${v.helpUrl}`)
    .join("\n");
  expect(serious, summary).toEqual([]);
}
