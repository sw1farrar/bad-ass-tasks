import type { NextRequest } from "next/server";
import {
  isDualAuthEnforced,
  isDualAuthSatisfied,
  maskEmail,
} from "@/lib/auth/dualAuth";
import {
  fetchActiveDualAuthChallenge,
  retryAfterForActiveChallenge,
} from "@/lib/auth/dualAuthChallenges";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type DualAuthStatusPayload = {
  required: boolean;
  verified: boolean;
  enforced: boolean;
  email: string;
  hasActiveCode: boolean;
  retryAfterSeconds: number;
};

export async function resolveDualAuthStatus(
  request: NextRequest,
  userId: string,
  email: string,
): Promise<DualAuthStatusPayload> {
  const masked = maskEmail(email);

  if (!isDualAuthEnforced()) {
    return {
      required: false,
      verified: true,
      enforced: false,
      email: masked,
      hasActiveCode: false,
      retryAfterSeconds: 0,
    };
  }

  const verified = isDualAuthSatisfied(request, userId);

  let hasActiveCode = false;
  let retryAfterSeconds = 0;

  if (!verified) {
    try {
      const admin = createAdminSupabaseClient();
      const active = await fetchActiveDualAuthChallenge(admin as never, userId);
      hasActiveCode = !!active;
      retryAfterSeconds = retryAfterForActiveChallenge(active);
    } catch {
      hasActiveCode = false;
      retryAfterSeconds = 0;
    }
  }

  return {
    required: true,
    verified,
    enforced: true,
    email: masked,
    hasActiveCode,
    retryAfterSeconds,
  };
}