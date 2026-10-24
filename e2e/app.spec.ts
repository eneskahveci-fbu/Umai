import { test, expect } from "@playwright/test";

/* Uygulama kabuğu "smoke" testleri — /app misafir erişimine açıktır
   (bkz. src/lib/authGate.ts): oturumsuz kullanıcı da yerel modda çalışır.
   Girişsiz senaryoda doğru davranış /app'in açılması + sohbet kabuğunun
   görünmesidir. LLM çağrısı YAPILMAZ (deterministik kalsın). */
test.describe("Uygulama", () => {
  test("girişsiz /app misafir olarak açılır", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole("button", { name: "Yeni sohbet" }).first()).toBeVisible({ timeout: 20_000 });
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
