import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Server-only site admin allowlist. Never import from client components. */
export function getSiteAdminEmails(): string[] {
  const fromEnv = (process.env.SITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  // Production requires explicit SITE_ADMIN_EMAILS — no hardcoded fallback.
  if (process.env.NODE_ENV === "production") return [];
  return ["sw1farrar@gmail.com"];
}

export function isSiteAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getSiteAdminEmails().includes(normalized);
}

export function isSiteAdminUser(user: Pick<User, "email"> | null | undefined): boolean {
  return isSiteAdminEmail(user?.email ?? null);
}

/** Returns the authenticated user if they are a site admin; otherwise null. */
export async function requireSiteAdmin(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isSiteAdminUser(user)) {
    return null;
  }

  return user;
}