import { test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./fixtures/a11y";

/* Erişilebilirlik otomasyonu — kimlik gerektirmeyen yüzeyler. Kimlik
   gerektiren `/app` ve `/studio` taramaları mobile.spec.ts içinde (zaten
   oturum açılmış context'te) yapılıyor — burada tekrar login akışına
   girmeye gerek yok. */
test.describe("Erişilebilirlik (axe-core) — herkese açık yüzeyler", () => {
  test("/ — ciddi ihlal yok", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousA11yViolations(page);
  });

  test("/login — ciddi ihlal yok", async ({ page }) => {
    await page.goto("/login");
    await expectNoSeriousA11yViolations(page);
  });
});
