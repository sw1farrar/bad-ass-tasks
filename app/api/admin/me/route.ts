import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/auth/isSiteAdmin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ isSiteAdmin: false, configured: false });
  }

  const user = await requireSiteAdmin();
  if (!user) {
    return NextResponse.json({ isSiteAdmin: false, configured: true });
  }

  return NextResponse.json({
    isSiteAdmin: true,
    configured: true,
    email: user.email,
  });
}