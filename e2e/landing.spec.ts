import { test, expect } from "@playwright/test";

test.describe("Landing", () => {
  test("açılış sayfası yüklenir ve başlık doğru", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Craft/i);
    await expect(page.getByRole("heading", { name: /gerisini yapay zeka/i })).toBeVisible();
  });

  test("iki yol kartı görünür ve doğru yönlendirir", async ({ page }) => {
    await page.goto("/");
    const creative = page.getByRole("link", { name: /Yaratmaya başla/i });
    const code = page.getByRole("link", { name: /Kodlamaya başla/i });
    await expect(creative).toBeVisible();
    await expect(code).toBeVisible();
    await expect(creative).toHaveAttribute("href", "/studio");
    await expect(code).toHaveAttribute("href", "/app");
  });

  test("ana CTA /app'e götürür", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /Ücretsiz başla/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/app");
  });
});
