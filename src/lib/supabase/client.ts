import { createBrowserClient } from "@supabase/ssr";

/** Supabase ortam değişkenleri tanımlı mı? Değilse uygulama localStorage moduna düşer. */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Tarayıcı tarafı Supabase istemcisi. Yapılandırılmamışsa null döner. */
export function createClient() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
