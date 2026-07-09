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
  /* Kimlik gerektiren spec'ler (mobile/chat/studio/settings-fusion) TEK bir
     paylaşılan test hesabının storageState'ini yeniden kullanır (bkz.
     global-setup.ts) — farklı worker'larda eşzamanlı config yazmaları
     (ör. Stüdyo kaydet + Fusion ayarı) aynı hesapta yarışa girmesin diye
     tek worker'da, sırayla çalıştırılır. */
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* HTML rapor CI'da da üretilir — GitHub Actions artifact'ı olarak yüklenir,
     başarısız bir e2e'nin trace/screenshot'ını incelemenin tek yolu budur. */
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /* HTTPS_PROXY tanımlıysa tarayıcı da onu kullanır (Playwright bunu
       otomatik okumaz) — localhost/dev sunucusu trafiği atlanır (bypass),
       yalnız dışarı çıkan istekler (Supabase vb.) proxy'den geçer. */
    proxy: (process.env.HTTPS_PROXY || process.env.https_proxy)
      ? { server: (process.env.HTTPS_PROXY || process.env.https_proxy)!, bypass: "localhost,127.0.0.1" }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /* Ortamda hazır bir Chromium varsa (CI/sandbox — Playwright indirme
           erişimi yoksa) PW_EXECUTABLE_PATH ile o binary kullanılır. Boşsa
           Playwright kendi indirdiği tarayıcıyı kullanır (yerel/normal). */
        ...(process.env.PW_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH, args: ["--no-sandbox"] } }
          : {}),
      },
    },
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
