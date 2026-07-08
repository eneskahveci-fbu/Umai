import { test, expect } from "@playwright/test";
import { hasAuthState, AUTH_STATE_PATH } from "./fixtures/auth";

/* Kullanıcı mesajının klasik sohbet balonu (sağda, dar, avatarsız) olarak
   render edildiğini doğrular. LLM çağrısının SONUCUNU beklemez (deterministik
   kalsın — bkz. app.spec.ts'in kendi ilkesi): mesaj gönderilir gönderilmez
   kullanıcı balonu DOM'da anında görünür, kontrol bunun üstünde yapılır. */
test.describe("Sohbet — kullanıcı balonu sağda", () => {
  test.skip(!hasAuthState(), "E2E test hesabıyla oturum açılamadı — testler atlandı.");
  test.use({ storageState: AUTH_STATE_PATH });

  test("kullanıcı mesajı sağa hizalı, dar bir balonda görünür", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.getByPlaceholder("Mesajınızı yazın…");
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill("e2e test mesajı — sağ hizalama kontrolü");
    await textarea.press("Enter");

    const bubble = page.locator(".user-bubble").first();
    await expect(bubble).toBeVisible();

    const viewport = page.viewportSize();
    const box = await bubble.boundingBox();
    expect(box).not.toBeNull();
    if (box && viewport) {
      expect(box.width).toBeLessThan(viewport.width * 0.8);
      expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.5);
    }
  });
});
