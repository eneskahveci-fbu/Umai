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

  test("girişsiz /studio → /login yönlendirmesi", async ({ page }) => {
    await page.goto("/studio");
    await page.waitForURL(/\/login/, { timeout: 20_000 });
  });

  test("girişsiz /settings → /login yönlendirmesi", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/login/, { timeout: 20_000 });
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
