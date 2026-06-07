import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/auth/isSiteAdmin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { fetchPlatformAnalytics, fetchPlatformStats } from "@/lib/admin/platformData";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Admin API is not configured on the server." }, { status: 503 });
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [stats, analytics] = await Promise.all([
      fetchPlatformStats(),
      fetchPlatformAnalytics(),
    ]);
    return NextResponse.json({ ok: true, stats, analytics });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}