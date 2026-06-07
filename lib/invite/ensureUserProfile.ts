import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Ensures a profiles row exists before workspace_members insert.
 * Required on live DBs where workspace_members.user_id FK references profiles.id.
 * Uses service role because profiles RLS has no INSERT policy for end users.
 */
export async function ensureUserProfile(userId: string, email?: string | null): Promise<void> {
  const admin = createAdminSupabaseClient();

  let resolvedEmail = email?.trim() || null;
  if (!resolvedEmail) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      throw new Error(error.message || "Could not load user for profile creation.");
    }
    resolvedEmail = data.user?.email ?? null;
  }

  const row: { id: string; email?: string } = { id: userId };
  if (resolvedEmail) row.email = resolvedEmail;

  const { error: profileError } = await admin.from("profiles").upsert(row as never, {
    onConflict: "id",
  });

  if (profileError) {
    throw new Error(profileError.message || "Could not create user profile.");
  }
}