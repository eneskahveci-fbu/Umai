import { test, expect, type Page } from "@playwright/test";

/* Uygulama "smoke" testleri — anonim/yerel modda (giriş gerekmez) çökmeden
   açılmalı ve temel sohbet bileşeni hazır olmalı. LLM çağrısı YAPILMAZ
   (deterministik kalsın). */

/* İlk ziyarette "hoş geldin" tanıtım modalı (OnboardingTour) açılır ve odak
   tuzağıyla etkileşimi engeller; testlerden önce kapatılır (gerçek ilk-açılış). */
async function dismissOnboarding(page: Page) {
  const skip = page.getByRole("button", { name: "Atla" });
  try {
    await skip.waitFor({ state: "visible", timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: "hidden", timeout: 4000 });
  } catch {
    /* tanıtım görünmediyse (flag set) sorun yok */
  }
}

test.describe("Uygulama", () => {
  test("/app çökmeden yüklenir ve mesaj kutusu hazır", async ({ page }) => {
    await page.goto("/app");
    await dismissOnboarding(page);
    // Composer (textarea) görünür olmalı — uygulama temel olarak çalışıyor demektir.
    const composer = page.locator("textarea").first();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill("merhaba");
    await expect(composer).toHaveValue("merhaba");
  });

  test("klavye kısayolu ile ayarlar açılır (Ctrl+,)", async ({ page }) => {
    await page.goto("/app");
    await dismissOnboarding(page);
    await page.locator("textarea").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.keyboard.press("Control+Comma");
    // Ayarlar modali bir diyalog/başlık göstermeli (Model sekmesi vb.).
    await expect(page.getByText(/Model/).first()).toBeVisible({ timeout: 10_000 });
  });
});
