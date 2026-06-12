"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let cachedKey = "";

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const key = `${url}:${anonKey}`;
  if (cached && cachedKey === key) return cached;

  cached = createBrowserClient(url, anonKey);
  cachedKey = key;
  return cached;
}
