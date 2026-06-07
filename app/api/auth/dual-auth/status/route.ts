import { NextResponse, type NextRequest } from "next/server";
import { isDualAuthEnforced, isDualAuthSatisfied, maskEmail } from "@/lib/auth/dualAuth";
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

  if (!isDualAuthEnforced()) {
    return NextResponse.json({
      required: false,
      verified: true,
      enforced: false,
      email: maskEmail(user.email ?? ""),
    });
  }

  const verified = isDualAuthSatisfied(request, user.id);

  return NextResponse.json({
    required: true,
    verified,
    enforced: true,
    email: maskEmail(user.email ?? ""),
  });
}