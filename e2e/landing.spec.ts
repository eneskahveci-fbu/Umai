import { test, expect } from "@playwright/test";

/* Landing, prompt.md'nin kuzey yıldızına göre kuruludur: TEK mesaj ("asla
   ödeme yapmadan, asla limitle karşılaşmadan") ve birincil CTA her zaman
   sohbet/kod. Eski "iki yol" bölümü (Stüdyo'yu kodlamayla eşit ağırlıkta
   sunan kartlar) prompt.md 3a gereği KALDIRILDI; bu dosyanın eski hâli o
   bölümü ve eski başlığı ("…gerisini yapay zekâ") test ediyor, her koşuda
   kırmızıydı. Bu testler artık kararın kendisini korur. */
test.describe("Landing", () => {
  test("açılış sayfası yüklenir; başlık kuzey yıldızı cümlesidir", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Umai/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/asla ödeme yapmadan/i);
  });

  test("birincil CTA sohbete götürür (/app)", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /Sohbete başla/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/app");
  });

  test("Stüdyo hero'da EŞİT ağırlıkta değil: yalnız ikincil bir bağlantı (prompt.md 3a)", async ({ page }) => {
    await page.goto("/");
    // Eski eşit-ağırlıklı kartlar geri gelmemeli.
    await expect(page.getByRole("link", { name: /Yaratmaya başla/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Kodlamaya başla/i })).toHaveCount(0);
    // Stüdyo kaldırılmadı (3b): küçük bir "göz at" bağlantısı olarak duruyor.
    const studio = page.getByRole("link", { name: /Stüdyo'ya göz at/i });
    await expect(studio).toBeVisible();
    await expect(studio).toHaveAttribute("href", "/studio");
  });
});
