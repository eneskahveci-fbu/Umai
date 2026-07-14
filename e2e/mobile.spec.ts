import { test, expect } from "@playwright/test";
import { hasAuthState, AUTH_STATE_PATH } from "./fixtures/auth";
import { expectNoSeriousA11yViolations } from "./fixtures/a11y";

/* Mobil alt sekme (4 öğe: Sohbet/Stüdyo/Kütüphane/Ayarlar) + Ayarlar modalı +
   genel üst-üste-binme kontrolü. İçerik araçları (Doküman/Anket/Defter/Kroki/
   Kartlar) ayrı bir "Araçlar" sekmesi olmaktan çıktı — Stüdyo ana ekranındaki
   büyük araç kartlarından erişiliyor (bkz. studio.spec.ts). Kimlik gerektirir
   — bkz. global-setup.ts. */
test.describe("Mobil alt sekme + Ayarlar", () => {
  test.skip(!hasAuthState(), "E2E test hesabıyla oturum açılamadı (bkz. global-setup.ts konsol uyarısı) — kimlik gerektiren testler atlandı.");
  test.use({ storageState: AUTH_STATE_PATH, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("4 öğeli alt sekme görünür, yatay taşma yok", async ({ page }) => {
    await page.goto("/app");
    const nav = page.getByRole("navigation", { name: "Alt gezinme" });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    for (const label of ["Sohbet", "Stüdyo", "Kütüphane", "Ayarlar"]) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await expectNoSeriousA11yViolations(page);
  });

  test("Ayarlar → modal açılır", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("navigation", { name: "Alt gezinme" }).getByText("Ayarlar", { exact: true }).click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
  });

  test("/studio mobilde yatay taşma yok (tek üst çubuk, panel çakışması yok)", async ({ page }) => {
    await page.goto("/studio");
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await expectNoSeriousA11yViolations(page);
  });
});
