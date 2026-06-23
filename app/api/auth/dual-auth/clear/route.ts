import { NextResponse, type NextRequest } from "next/server";
import { clearDualAuthCookie, shouldPreserveDualAuthCookieOnSignOut } from "@/lib/auth/dualAuth";
import { logDualAuthAbandonedIfNeeded } from "@/lib/auth/logDualAuthEvents";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const preserveTrustedDevice = shouldPreserveDualAuthCookieOnSignOut(request);

  await logDualAuthAbandonedIfNeeded(request, user.id, user.email);

  await logAuthLoginEventFromRequest(request, {
    eventType: "logout",
    userId: user.id,
    email: user.email,
    metadata: { preserveTrustedDevice },
  });

  if (preserveTrustedDevice) {
    return response;
  }

  clearDualAuthCookie(response);
  return response;
}