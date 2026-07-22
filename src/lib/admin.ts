/* Admin kapısı. Yalnız aşağıdaki e-posta(lar) "admin" sayılır ve hassas ayarlara
   (Hibrit Sunucu / Terminal vb.) erişebilir. Yeni kayıt olan normal kullanıcılar
   bu bölümleri göremez.

   GÜVENLİK NOTU: Bu istemci-tarafı bir UI kapısıdır (gizleme). Gerçek yetki için
   sunucu (Supabase RLS / API) tarafı esastır; burası kullanıcı deneyimini kısıtlar.

   KURULUM: admin e-postanı ADMIN_EMAILS dizisine ekle (küçük/büyük harf önemsiz). */
const RAW_ADMINS: string[] = [
  "muhammeteneskahveci@gmail.com",
];

export const ADMIN_EMAILS: string[] = RAW_ADMINS.map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  /* FAIL-CLOSED: liste boşsa HİÇ KİMSE admin değildir. Önceden boş listede `true`
     dönüyordu — bu, admin/users & admin/analytics'in TEK sunucu yetkisi olduğundan,
     liste kazara boşalırsa (ör. env-tabanlı olur da tanımsız kalırsa) her girişli
     kullanıcıya (yeni kayıt misafir dahil) tüm kullanıcı verisini açıyordu. */
  if (ADMIN_EMAILS.length === 0) return false;
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
