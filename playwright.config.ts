import { defineConfig, devices } from "@playwright/test";

/* E2E testleri — kritik akışları gerçek tarayıcıda doğrular. `npm run test`
   (vitest, birim) ile karışmaz; ayrı `npm run test:e2e` ile çalışır.
   webServer: dev sunucusunu otomatik başlatır (CI dışında mevcut sunucuyu yeniden
   kullanır). LLM çağrısı yapan akışlar yerine deterministik UI kontrolleri. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
