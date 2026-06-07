import { NextResponse, type NextRequest } from "next/server";
import { clearDualAuthCookie, shouldPreserveDualAuthCookieOnSignOut } from "@/lib/auth/dualAuth";
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

  if (shouldPreserveDualAuthCookieOnSignOut(request)) {
    return response;
  }

  clearDualAuthCookie(response);
  return response;
}