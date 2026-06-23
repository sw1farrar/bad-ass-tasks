import "server-only";

import { getClientIp, getUserAgent } from "@/lib/auth/clientIp";
import { readDualAuthCookie } from "@/lib/auth/dualAuth";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { NextRequest } from "next/server";

type AuthLoginEventInsert = Database["public"]["Tables"]["auth_login_events"]["Insert"];

export type AuthLoginEventType =
  | "login_success"
  | "login_failed"
  | "dual_auth_required"
  | "dual_auth_prompted"
  | "dual_auth_sent"
  | "dual_auth_verified"
  | "dual_auth_failed"
  | "dual_auth_abandoned"
  | "password_reset_requested"
  | "password_changed"
  | "logout";

export type AuthLoginMethod = "password" | "google" | "otp_recovery" | "invite";

export type AuthLoginEventInput = {
  eventType: AuthLoginEventType;
  userId?: string | null;
  email?: string | null;
  authMethod?: AuthLoginMethod | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
};

function isMissingLoginEventsTable(message: string | undefined): boolean {
  const lower = message?.toLowerCase() ?? "";
  return lower.includes("auth_login_events") && (lower.includes("does not exist") || lower.includes("relation"));
}

/** Inserts an auth audit row. Never throws — logging must not block sign-in flows. */
export async function logAuthLoginEvent(input: AuthLoginEventInput): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;

  try {
    const admin = createAdminSupabaseClient();
    const row: AuthLoginEventInsert = {
      user_id: input.userId ?? null,
      email: input.email?.trim().toLowerCase() ?? null,
      event_type: input.eventType,
      auth_method: input.authMethod ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      device_id: input.deviceId ?? null,
      metadata: (input.metadata ?? {}) as AuthLoginEventInsert["metadata"],
    };
    const events = admin.from("auth_login_events") as ReturnType<typeof admin.from>;
    const { error } = await events.insert(row);

    if (error && !isMissingLoginEventsTable(error.message)) {
      console.error("[auth] login event log failed:", error.message);
    }
  } catch (err) {
    console.error("[auth] login event log failed:", err);
  }
}

export async function logAuthLoginEventFromRequest(
  request: Request | NextRequest,
  input: Omit<AuthLoginEventInput, "ipAddress" | "userAgent" | "deviceId"> & {
    deviceId?: string | null;
  },
): Promise<void> {
  const deviceId =
    input.deviceId ??
    ("cookies" in request ? readDualAuthCookie(request as NextRequest)?.did ?? null : null);

  await logAuthLoginEvent({
    ...input,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
    deviceId,
  });
}