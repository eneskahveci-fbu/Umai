import { test, expect } from "@playwright/test";

test.describe("Landing", () => {
  test("açılış sayfası yüklenir ve başlık doğru", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/UMAI/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/kod yaz/i);
  });

  test("ana CTA /app'e götürür", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /Sohbete başla/i }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/app");
  });

  test("Ajan İzi vitrini görünür", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Kutunun içini gör/i })).toBeVisible();
    await expect(page.getByText(/Salt okunur kayıt/i)).toBeVisible();
  });
});
