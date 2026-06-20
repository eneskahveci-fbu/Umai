import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "./config";

/**
 * Sunucu tarafı Supabase istemcisi (Route Handler / Server Component).
 * Next.js 16'da cookies() asenkron olduğu için await edilir.
 * Yapılandırılmamışsa null döner.
 */
export async function createClient() {
  if (!supabaseConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component içinden çağrıldıysa set başarısız olabilir; yok sayılır.
          }
        },
      },
    },
  );
}
