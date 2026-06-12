// src/lib/supabase/client.ts — Tarayıcı tarafı Supabase client (singleton)

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeJSONParse } from "../validate";

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Girişsiz / misafir mod: client yok
    return null as unknown as SupabaseClient;
  }

  supabase = createBrowserClient(url, anonKey);
  return supabase;
}

// createClient alias — app/page.tsx uyumluluğu için
export function createClient(): SupabaseClient | null {
  try {
    return getSupabaseClient();
  } catch {
    return null;
  }
}

//─────── Chat share helpers ───────
export interface ChatSharePayload {
  id?: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: number;
    artifacts?: unknown[];
    modelId?: string;
  }>;
}

export async function shareChat(
  payload: ChatSharePayload,
): Promise<{ id: string }> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("shared_chats")
    .upsert({
      id: payload.id,
      messages: payload.messages,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Sohbet paylaşılamadı: ${error.message}`);
  return { id: (data as { id: string }).id };
}

export async function getSharedChat(
  id: string,
): Promise<ChatSharePayload | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("shared_chats")
    .select("messages")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return {
    id,
    messages: safeJSONParse(
      JSON.stringify((data as { messages: unknown }).messages),
      [],
    ),
  };
}
