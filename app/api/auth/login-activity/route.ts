import { NextResponse } from "next/server";
import { fetchUserLoginActivity } from "@/lib/auth/loginActivity";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Login activity is not configured on the server." }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit") ?? 40)));

  try {
    const events = await fetchUserLoginActivity(user.id, user.email, limit);
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load login activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}