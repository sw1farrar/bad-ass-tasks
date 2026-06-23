import "server-only";

import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { LoginEventRow } from "@/lib/auth/loginActivityShared";

export type { LoginEventRow } from "@/lib/auth/loginActivityShared";
export { formatLoginEventDetail, formatLoginEventLabel } from "@/lib/auth/loginActivityShared";

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

/** Returns login audit rows for a single user only (by user id and account email). */
export async function fetchUserLoginActivity(
  userId: string,
  email: string | null | undefined,
  limit = 50,
): Promise<LoginEventRow[]> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Login activity is not available.");
  }

  const admin = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  type DbRow = {
    id: string;
    event_type: string;
    auth_method: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

  let query = admin
    .from("auth_login_events")
    .select("id, event_type, auth_method, ip_address, user_agent, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (normalizedEmail) {
    query = query.or(`user_id.eq.${userId},email.eq.${normalizedEmail}`);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load login activity");
  }

  return ((data ?? []) as DbRow[]).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    authMethod: row.auth_method,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }));
}