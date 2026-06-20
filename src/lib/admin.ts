/* Admin kapısı. Yalnız aşağıdaki e-posta(lar) "admin" sayılır ve hassas ayarlara
   (Hibrit Sunucu / Terminal vb.) erişebilir. Yeni kayıt olan normal kullanıcılar
   bu bölümleri göremez.

   GÜVENLİK NOTU: Bu istemci-tarafı bir UI kapısıdır (gizleme). Gerçek yetki için
   sunucu (Supabase RLS / API) tarafı esastır; burası kullanıcı deneyimini kısıtlar.

   KURULUM: admin e-postanı ADMIN_EMAILS dizisine ekle (küçük/büyük harf önemsiz).
   Liste BOŞSA hiç kimse kilitlenmez (kurulum öncesi güvenli varsayılan). */
const RAW_ADMINS: string[] = [
  // "ben@ornek.com",   ← admin e-postanı buraya ekle
];

export const ADMIN_EMAILS: string[] = RAW_ADMINS.map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (ADMIN_EMAILS.length === 0) return true; // henüz admin tanımlı değil → kilitleme yok
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
