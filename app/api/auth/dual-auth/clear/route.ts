import { NextResponse, type NextRequest } from "next/server";
import { clearDualAuthCookie, shouldPreserveDualAuthCookieOnSignOut } from "@/lib/auth/dualAuth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

  if (shouldPreserveDualAuthCookieOnSignOut(request)) {
    return response;
  }

  clearDualAuthCookie(response);
  return response;
}