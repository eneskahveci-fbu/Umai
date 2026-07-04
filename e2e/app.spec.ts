import { test, expect } from "@playwright/test";

/* Uygulama kabuğu "smoke" testleri — /app bilinçli olarak auth kapılıdır
   (girişsiz açılmaz, bkz. src/lib/authGate.ts). Girişsiz senaryoda doğru
   davranış /login yönlendirmesi + çalışan bir giriş formudur. LLM çağrısı
   YAPILMAZ (deterministik kalsın). */
test.describe("Uygulama", () => {
  test("girişsiz /app → /login yönlendirmesi", async ({ page }) => {
    await page.goto("/app");
    await page.waitForURL(/\/login/, { timeout: 20_000 });
  });

  test("/login formu hazır: e-posta alanı doldurulabiliyor", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator('input[type="email"]');
    await expect(email).toBeVisible({ timeout: 15_000 });
    await email.fill("test@example.com");
    await expect(email).toHaveValue("test@example.com");
    // Giriş sekmesi + gönder butonu görünür (form çökmeden kurulmuş).
    await expect(page.getByRole("button", { name: "Giriş Yap" }).first()).toBeVisible();
  });
});
