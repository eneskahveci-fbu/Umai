import { test, expect } from "@playwright/test";
import { hasAuthState, AUTH_STATE_PATH } from "./fixtures/auth";

/* Ayarlar → Fusion sekmesi — herkese açık olmalı (admin şartı yok). */
test.describe("Ayarlar → Fusion sekmesi", () => {
  test.skip(!hasAuthState(), "E2E test hesabıyla oturum açılamadı — testler atlandı.");
  test.use({ storageState: AUTH_STATE_PATH });

  test("Fusion sekmesi admin olmayan hesapta görünür, Manuel modda model seçilebilir", async ({ page }) => {
    await page.goto("/settings?tab=fusion");
    await expect(page.getByRole("heading", { name: "Fusion nedir?" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Manuel" }).click();
    await expect(page.getByText("Taslak modelleri")).toBeVisible();
    await expect(page.getByText("Pollinations", { exact: true }).first()).toBeVisible();
  });
});
