import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/auth/isSiteAdmin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { verifyDatabaseSchema } from "@/lib/supabase/verifyDatabaseSchema";

/** Site-admin diagnostic: confirms Supabase connection + required schema objects. */
export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin API is not configured on the server." },
      { status: 503 },
    );
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await verifyDatabaseSchema();
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}