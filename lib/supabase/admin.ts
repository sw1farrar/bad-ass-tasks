import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** Server-only Supabase admin client (service role). Never import from client components. */
export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return !!(url && key && key.length > 20);
}

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase admin is not configured (missing URL or SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}