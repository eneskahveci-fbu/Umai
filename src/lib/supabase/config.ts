/* Supabase bağlantı bilgisi — TEK kaynak.
   Vercel env değişkenleri (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY) tanımlıysa onlar
   kullanılır; tanımlı DEĞİLSE aşağıdaki sabit değerlere düşülür. anon `public`
   anahtarı herkese açıktır (istemci paketine zaten gömülür, RLS korur) — bu yüzden
   koda gömmek güvenlidir. Böylece env eksik olsa bile auth/login/admin çalışır.

   Not: İstersen yine de Vercel'e env eklersen otomatik onlar öncelikli olur. */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://qcpbcscacxbfjaccyeob.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcGJjc2NhY3hiZmphY2N5ZW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzE2NTMsImV4cCI6MjA5NjM0NzY1M30.0I7E_NLQp6ga6dY0WTyg7_I02wq-BFYTdtZc-wEKQLQ";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
