import { test, expect } from "@playwright/test";
import { hasAuthState, AUTH_STATE_PATH } from "./fixtures/auth";

/* Stüdyo — Projelerim (kaydet/aç) yuvarlak-yolculuğu. */
test.describe("Stüdyo — kaydet/aç (Projelerim)", () => {
  test.skip(!hasAuthState(), "E2E test hesabıyla oturum açılamadı — testler atlandı.");
  test.use({ storageState: AUTH_STATE_PATH });

  test("proje kaydedilir ve Projelerim'den tekrar açılabilir", async ({ page }) => {
    await page.goto("/studio");
    const saveBtn = page.getByTitle("Kaydet").first();
    await expect(saveBtn).toBeVisible({ timeout: 15_000 });
    await saveBtn.click();

    await page.getByTitle("Projelerim").first().click();
    await expect(page.getByText("Henüz kayıtlı proje yok.")).not.toBeVisible();
    await expect(page.getByText("Yeni Tasarım").first()).toBeVisible();
  });
});
