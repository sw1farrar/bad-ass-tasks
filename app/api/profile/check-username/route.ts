import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { checkUsernameAvailable } from "@/lib/profile/checkUsernameAvailable";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Username check is not configured on the server." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim() ?? "";

  if (!username) {
    return NextResponse.json({ available: false, error: "Username is required." }, { status: 400 });
  }

  const result = await checkUsernameAvailable(username);
  return NextResponse.json({
    available: result.available,
    username: result.username,
    error: result.error,
  });
}