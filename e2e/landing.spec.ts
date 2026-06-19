import { test, expect } from "@playwright/test";

test.describe("Landing", () => {
  test("açılış sayfası yüklenir ve başlık doğru", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Craft\.Coder/i);
    await expect(page.getByRole("heading", { name: /AI asistanın/i })).toBeVisible();
  });

  test("'Hemen Başla' /app'e götürür", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /Hemen Başla/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/app");
  });

  test("terminal kurulum komutu görünür (tek-komut)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/install\.sh/i)).toBeVisible();
  });
});
