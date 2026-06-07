import { NextResponse, type NextRequest } from "next/server";
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
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const masked = maskEmail(user.email ?? "");

  if (!isDualAuthEnforced()) {
    return NextResponse.json({
      required: false,
      verified: true,
      enforced: false,
      email: masked,
      hasActiveCode: false,
      retryAfterSeconds: 0,
    });
  }

  const verified = isDualAuthSatisfied(request, user.id);

  let hasActiveCode = false;
  let retryAfterSeconds = 0;

  if (!verified) {
    try {
      const admin = createAdminSupabaseClient();
      const active = await fetchActiveDualAuthChallenge(admin as never, user.id);
      hasActiveCode = !!active;
      retryAfterSeconds = retryAfterForActiveChallenge(active);
    } catch {
      // Non-fatal: client can still prompt to send.
      hasActiveCode = false;
      retryAfterSeconds = 0;
    }
  }

  return NextResponse.json({
    required: true,
    verified,
    enforced: true,
    email: masked,
    hasActiveCode,
    retryAfterSeconds,
  });
}