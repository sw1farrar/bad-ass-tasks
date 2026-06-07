import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/auth/isSiteAdmin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { fetchPlatformActivity } from "@/lib/admin/platformData";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Admin API is not configured on the server." }, { status: 503 });
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit") ?? 80)));

  try {
    const activity = await fetchPlatformActivity(limit);
    return NextResponse.json({ ok: true, activity });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}