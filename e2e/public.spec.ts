import { test, expect } from "@playwright/test";

/* Girişsiz (auth gerektirmeyen) yüzeylerin sağlık kontrolleri — CI/sandbox'ta
   oturum olmadan da koşar. Hata-sıfır programının temel bekçileri. */
test.describe("Public yüzeyler", () => {
  test("/api/health canlı ve sürüm döndürüyor", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(typeof j.version).toBe("string");
  });

  /* Stüdyo ve Ayarlar ARTIK misafir-erişimli (src/lib/authGate.ts
     useAuthState: "asla yönlendirmez" — prompt.md Hamle 2'nin /app dışına
     taşınmış hâli). Eski testler /login yönlendirmesi bekliyordu; ürün
     kararıyla çelişen bayat varsayımlardı. Artık kararın kendisi korunuyor:
     yönlendirme YOK, sayfa gerçekten render oluyor. */
  test("girişsiz /studio misafir olarak açılır (yönlendirme yok)", async ({ page }) => {
    await page.goto("/studio");
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(new URL(page.url()).pathname).toBe("/studio");
    await expect(page.getByRole("main").or(page.locator("body"))).not.toBeEmpty();
  });

  test("girişsiz /settings misafir olarak açılır (yönlendirme yok)", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(new URL(page.url()).pathname).toBe("/settings");
    await expect(page.getByRole("main").or(page.locator("body"))).not.toBeEmpty();
  });

  test("sitemap /pricing içeriyor", async ({ request }) => {
    const r = await request.get("/sitemap.xml");
    expect(r.ok()).toBeTruthy();
    expect(await r.text()).toContain("/pricing");
  });

  test("robots.txt /api'yi kapatıyor", async ({ request }) => {
    const r = await request.get("/robots.txt");
    expect(r.ok()).toBeTruthy();
    expect(await r.text()).toContain("/api/");
  });
});
