import { NextResponse, type NextRequest } from "next/server";
import { resolveDualAuthStatus } from "@/lib/auth/dualAuthStatus";
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

  const status = await resolveDualAuthStatus(request, user.id, user.email ?? "");
  return NextResponse.json(status);
}