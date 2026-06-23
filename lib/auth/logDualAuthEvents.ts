import "server-only";

import type { NextRequest } from "next/server";
import type { DualAuthStatusPayload } from "@/lib/auth/dualAuthStatus";
import { fetchActiveDualAuthChallenge } from "@/lib/auth/dualAuthChallenges";
import { isDualAuthEnforced, isDualAuthSatisfied } from "@/lib/auth/dualAuth";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function logDualAuthRequiredIfNeeded(
  request: NextRequest,
  userId: string,
  email: string,
  dualAuth: Pick<DualAuthStatusPayload, "enforced" | "required" | "verified" | "hasActiveCode">,
): Promise<void> {
  if (!dualAuth.enforced || !dualAuth.required || dualAuth.verified) return;

  await logAuthLoginEventFromRequest(request, {
    eventType: "dual_auth_required",
    userId,
    email,
    metadata: {
      hasActiveCode: dualAuth.hasActiveCode,
      codeEntered: false,
    },
  });
}

export async function logDualAuthPrompted(
  request: NextRequest,
  userId: string,
  email: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await logAuthLoginEventFromRequest(request, {
    eventType: "dual_auth_prompted",
    userId,
    email,
    metadata: {
      codeEntered: false,
      ...metadata,
    },
  });
}

export async function logDualAuthAbandonedIfNeeded(
  request: NextRequest,
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  if (!isDualAuthEnforced() || isDualAuthSatisfied(request, userId)) return;

  let hadActiveCode = false;
  try {
    const admin = createAdminSupabaseClient();
    const active = await fetchActiveDualAuthChallenge(admin as never, userId);
    hadActiveCode = !!active;
  } catch {
    hadActiveCode = false;
  }

  await logAuthLoginEventFromRequest(request, {
    eventType: "dual_auth_abandoned",
    userId,
    email,
    metadata: {
      hadActiveCode,
      codeEntered: false,
      reason: "verification_not_completed",
    },
  });
}