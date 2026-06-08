import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Derive a human-readable display name from an email local part.
 * e.g. "john.doe" → "John Doe", "sarah_smith" → "Sarah Smith"
 */
export function deriveNameFromEmail(email: string): string | null {
  const local = email.split("@")[0]?.trim();
  if (!local) return null;

  return local
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Ensures a profiles row exists before workspace_members insert.
 * Required on live DBs where workspace_members.user_id FK references profiles.id.
 * Uses service role because profiles RLS has no INSERT policy for end users.
 */
export type EnsureUserProfileInput = {
  fullName?: string | null;
  username?: string | null;
  location?: string | null;
};

export async function ensureUserProfile(
  userId: string,
  email?: string | null,
  profile?: EnsureUserProfileInput | string | null,
): Promise<void> {
  const admin = createAdminSupabaseClient();

  let resolvedEmail = email?.trim() || null;
  if (!resolvedEmail) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      throw new Error(error.message || "Could not load user for profile creation.");
    }
    resolvedEmail = data.user?.email ?? null;
  }

  const profileInput: EnsureUserProfileInput =
    typeof profile === "string" ? { fullName: profile } : profile ?? {};

  const trimmedName = profileInput.fullName?.trim() || null;
  const trimmedUsername = profileInput.username?.trim() || null;
  const trimmedLocation = profileInput.location?.trim() || null;

  const { data: existing } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("id", userId)
    .maybeSingle();

  const existingFullName = (existing as { full_name?: string | null } | null)?.full_name?.trim();

  const row: { id: string; email?: string; full_name?: string; username?: string; location?: string } = {
    id: userId,
  };
  if (resolvedEmail) row.email = resolvedEmail;

  if (trimmedName) {
    row.full_name = trimmedName;
  } else if (!existingFullName && resolvedEmail) {
    const derived = deriveNameFromEmail(resolvedEmail);
    if (derived) row.full_name = derived;
  }
  if (trimmedUsername) row.username = trimmedUsername;
  if (trimmedLocation) row.location = trimmedLocation;

  const { error: profileError } = await admin.from("profiles").upsert(row as never, {
    onConflict: "id",
  });

  if (profileError) {
    throw new Error(profileError.message || "Could not create user profile.");
  }
}