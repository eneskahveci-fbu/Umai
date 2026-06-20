import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "./config";

/** Supabase env'leri (ya da fallback sabitleri) tanımlı mı? */
export { supabaseConfigured };

/** Tarayıcı tarafı Supabase istemcisi. Yapılandırılmamışsa null döner. */
export function createClient() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
