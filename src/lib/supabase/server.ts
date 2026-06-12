// src/lib/supabase/server.ts — Sunucu tarafı Supabase client (Next.js App Router)

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export async function getServerSupabase(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Sunucu tarafı Supabase için SUPABASE_URL ve SUPABASE_ANON_KEY gerekli",
    );
  }

  const cookieStore = await cookies();

  cachedClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  return cachedClient;
}

// Auth yardımcısı
export async function getServerSession() {
  const client = await getServerSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();
  return session;
}

export async function getServerUser() {
  const session = await getServerSession();
  return session?.user ?? null;
}
