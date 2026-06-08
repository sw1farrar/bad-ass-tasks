import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sanitizeUsername, validateUsername } from "@/lib/profile/username";

export async function checkUsernameAvailable(
  rawUsername: string,
  excludeUserId?: string,
): Promise<{ available: boolean; username: string; error?: string }> {
  const username = sanitizeUsername(rawUsername);
  const validation = validateUsername(username);
  if (!validation.ok) {
    return { available: false, username, error: validation.error };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return { available: false, username, error: "Could not check username availability." };
  }

  const row = data as { id?: string } | null;
  if (!row?.id) {
    return { available: true, username };
  }
  if (excludeUserId && row.id === excludeUserId) {
    return { available: true, username };
  }

  return { available: false, username, error: "That username is already taken." };
}