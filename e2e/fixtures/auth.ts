import path from "node:path";
import fs from "node:fs";

/* E2E kimlik doğrulama yardımcıları — bkz. yol haritası planı Faz 2.
   Bu sandbox'ta Supabase env'i yok → src/lib/supabase/config.ts GERÇEK
   ÜRETİM projesine (sabit anon key) düşer. Servis anahtarı KULLANILMAZ:
   global-setup.ts, Playwright'ın kendisiyle normal /login → "Kayıt Ol"
   akışını çalıştırıp TEK, açıkça ayırt edilebilir bir test hesabı açar
   (kullanıcı onayıyla — bkz. plan). E-posta onayı açıksa oturum hemen
   açılmaz; bu durumda kimlik gerektiren testler ATLANIR (fail değil). */

export const AUTH_STATE_PATH = path.join(__dirname, "..", ".auth-state.json");

/** Kimlik doğrulanmış bir Playwright oturum durumu (storageState) var mı?
    global-setup.ts başarısız olduysa (ör. e-posta onayı açık) bu dosya hiç
    yazılmaz — kimlik gerektiren spec'ler bunu kontrol edip test.skip yapar. */
export function hasAuthState(): boolean {
  return fs.existsSync(AUTH_STATE_PATH);
}
