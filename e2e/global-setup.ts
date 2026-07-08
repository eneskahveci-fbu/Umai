import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import { AUTH_STATE_PATH } from "./fixtures/auth";

/* Tüm testlerden ÖNCE BİR KEZ çalışır: gerçek /login → "Kayıt Ol" akışıyla
   TEK bir E2E test hesabı açar (servis anahtarı kullanılmaz, kullanıcı
   onayıyla — bkz. plan Faz 2), oturumu `storageState` olarak kaydeder.
   Kimlik gerektiren spec'ler `test.use({ storageState: AUTH_STATE_PATH })`
   ile bu oturumu yeniden kullanır — her spec kendi hesabını açmaz. */
/* Ortamda HTTPS_PROXY tanımlıysa (ör. kurumsal ağ/korumalı sandbox) Chromium'un
   KENDİSİ de onu kullanır — Playwright launch, ortam değişkenini otomatik
   OKUMAZ, tarayıcı proxy'siz doğrudan bağlanmaya çalışır. localhost/dev sunucusu
   trafiği proxy'yi ATLAR (bypass) — proxy yalnız DIŞARI çıkan (Supabase) trafiği
   taşır. */
function browserProxy(): { server: string; bypass?: string } | undefined {
  const server = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!server) return undefined;
  return { server, bypass: "localhost,127.0.0.1" };
}

/* Giriş gerçekten başarılı mı? URL'in "/login" İÇERMEMESİ tek başına yeterli
   değil — bir ağ/TLS hatası tarayıcıyı `chrome-error://…` gibi bir iç sayfaya
   düşürebilir, bu da yanlışlıkla "başarılı" sayılabilir. Gerçek uygulama
   origin'ine döndüğünü AÇIKÇA doğrula. */
function landedOnRealApp(page: import("@playwright/test").Page, baseURL: string): boolean {
  try {
    const url = new URL(page.url());
    const base = new URL(baseURL);
    return url.origin === base.origin && !url.pathname.startsWith("/login");
  } catch {
    return false;
  }
}

export default async function globalSetup(config: FullConfig) {
  // Önceki (ör. başarısız) bir koşudan kalma dosya varsa sil — `hasAuthState()`
  // yanlışlıkla eski/geçersiz bir oturumu "var" sanmasın.
  fs.rmSync(AUTH_STATE_PATH, { force: true });

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const executablePath = process.env.PW_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath, args: ["--no-sandbox"] } : {}),
    proxy: browserProxy(),
  });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    const email = `e2e-test+${Date.now()}@example.com`;
    const password = `E2e-${Date.now()}-Test!`;

    await page.goto("/login");
    await page.getByRole("button", { name: "Kayıt Ol" }).click();
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /Hesap Oluştur/ }).click();
    await page.waitForTimeout(1500);

    // Aynı bilgilerle giriş dene — e-posta onayı KAPALIYSA hemen başarılı olur.
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Giriş Yap" }).last().click();
    await page.waitForURL((u) => u.origin === new URL(baseURL).origin && !u.pathname.startsWith("/login"), { timeout: 8000 })
      .catch(() => { /* zaman aşımı — aşağıda kontrol edilir */ });

    if (!landedOnRealApp(page, baseURL)) {
      console.warn(
        `[e2e] Test hesabıyla oturum açılamadı (son URL: ${page.url()}) — Supabase projesinde e-posta onayı ` +
        "açık olabilir YA DA bu ortamdan Supabase'e ağ erişimi yok. Kimlik gerektiren e2e testleri " +
        "(mobile/chat/studio/settings-fusion) ATLANACAK.",
      );
      return;
    }

    await context.storageState({ path: AUTH_STATE_PATH });
    console.log(`[e2e] Test hesabı hazır: ${email}`);
  } finally {
    await browser.close();
  }
}
