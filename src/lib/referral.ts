import { createClient } from "./supabase/client";

/* Davet/referral — bkz. Ayarlar → Hesap "Arkadaşını davet et". Referral kodu
   AYRI bir tablo/üretim gerektirmez: her kullanıcının kendi auth.users.id'si
   koddur (link: /?ref=<uuid>). Akış: (1) captureReferralCode() linke düşülen
   İLK sayfada (/, /login, /app) kodu localStorage'a yazar; (2)
   recordReferralIfPending() kullanıcı giriş yaptığında (bkz. app/page.tsx'in
   onAuthStateChange'i) bekleyen kodu public.referrals'a TEK SEFERLİK yazar.
   Otomatik ödül/kredi kasıtlı olarak YOK (v1 kapsamı — bkz. supabase/schema.sql
   referrals bölümündeki not); bu yalnız davet sayısını izler. */

const REF_STORAGE_KEY = "craftai_referral_code";

/** UUID biçimine uyar mı (auth.users.id formatı). Saf — test edilebilir. */
export function isValidReferralCode(code: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
}

/** URL'deki ?ref=<uuid>'i yakalayıp localStorage'a yazar — yalnız henüz
 *  bekleyen bir kod yoksa (ilk yakalanan kod kazanır, sonraki linkler
 *  üzerine yazmaz). Sunucuya hiçbir istek yapmaz. */
export function captureReferralCode(): void {
  if (typeof window === "undefined") return;
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref || !isValidReferralCode(ref)) return;
    if (!window.localStorage.getItem(REF_STORAGE_KEY)) {
      window.localStorage.setItem(REF_STORAGE_KEY, ref);
    }
  } catch {
    /* localStorage erişilemezse (gizli sekme vb.) sessizce yoksay */
  }
}

/** Kullanıcı ilk kez oturum açtığında bekleyen bir referral kodu varsa
 *  public.referrals'a tek seferlik kaydeder. Kod her koşulda (başarılı/
 *  başarısız) hemen temizlenir — tekrar tekrar denenmez (ör. kullanıcı
 *  zaten kayıtlıysa unique kısıtı hatası beklenir ve sessizce yutulur). */
export function recordReferralIfPending(userId: string): void {
  if (typeof window === "undefined") return;
  let ref: string | null = null;
  try {
    ref = window.localStorage.getItem(REF_STORAGE_KEY);
    if (ref) window.localStorage.removeItem(REF_STORAGE_KEY);
  } catch {
    return;
  }
  if (!ref || !isValidReferralCode(ref) || ref === userId) return;
  try {
    const sb = createClient();
    if (!sb) return;
    void sb.from("referrals").insert({ referrer_id: ref, referred_id: userId })
      .then(() => { /* başarı — beklenen */ }, () => { /* zaten kayıtlı/hata — sessizce yoksay */ });
  } catch {
    /* referral asla ana akışı bozmasın */
  }
}

/** Kullanıcının paylaşılabilir davet linki. */
export function referralLink(userId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || "https://umai.vercel.app");
  return `${origin}/?ref=${userId}`;
}
