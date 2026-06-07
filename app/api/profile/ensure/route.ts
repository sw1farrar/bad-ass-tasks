import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/invite/ensureUserProfile";

export async function POST() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Profile bootstrap is not configured on the server." }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserProfile(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not ensure profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}