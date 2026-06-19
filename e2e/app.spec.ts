import { test, expect } from "@playwright/test";

/* Uygulama "smoke" testleri — anonim/yerel modda (giriş gerekmez) çökmeden
   açılmalı ve temel sohbet bileşeni hazır olmalı. LLM çağrısı YAPILMAZ
   (deterministik kalsın). */
test.describe("Uygulama", () => {
  test("/app çökmeden yüklenir ve mesaj kutusu hazır", async ({ page }) => {
    await page.goto("/app");
    // Composer (textarea) görünür olmalı — uygulama temel olarak çalışıyor demektir.
    const composer = page.locator("textarea").first();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill("merhaba");
    await expect(composer).toHaveValue("merhaba");
  });

  test("klavye kısayolu ile ayarlar açılır (Ctrl+,)", async ({ page }) => {
    await page.goto("/app");
    await page.locator("textarea").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.keyboard.press("Control+Comma");
    // Ayarlar modali bir diyalog/başlık göstermeli (Model sekmesi vb.).
    await expect(page.getByText(/Model/).first()).toBeVisible({ timeout: 10_000 });
  });
});
