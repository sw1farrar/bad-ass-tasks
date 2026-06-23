import { NextResponse, type NextRequest } from "next/server";
import { DUAL_AUTH_BOOTSTRAP_COOKIE } from "@/lib/auth/dualAuthClient";
import { logDualAuthRequiredIfNeeded } from "@/lib/auth/logDualAuthEvents";
import { resolveDualAuthStatus } from "@/lib/auth/dualAuthStatus";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function isPasswordRecoveryNext(next: string): boolean {
  return next.includes("reset-verify");
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const isRecoveryFlow = isPasswordRecoveryNext(next);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (isRecoveryFlow) {
        await logAuthLoginEventFromRequest(request, {
          eventType: "login_success",
          userId: data.user.id,
          email: data.user.email,
          authMethod: "otp_recovery",
          metadata: { via: "recovery_link" },
        });
        return NextResponse.redirect(`${origin}${next}`);
      }

      await logAuthLoginEventFromRequest(request, {
        eventType: "login_success",
        userId: data.user.id,
        email: data.user.email,
        authMethod: "google",
      });

      const dualAuth = await resolveDualAuthStatus(
        request,
        data.user.id,
        data.user.email ?? "",
      );
      await logDualAuthRequiredIfNeeded(request, data.user.id, data.user.email ?? "", dualAuth);
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set(DUAL_AUTH_BOOTSTRAP_COOKIE, JSON.stringify(dualAuth), {
        path: "/",
        maxAge: 60,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return response;
    }

    await logAuthLoginEventFromRequest(request, {
      eventType: "login_failed",
      authMethod: isRecoveryFlow ? "otp_recovery" : "google",
      metadata: { reason: error?.message ?? "oauth_exchange_failed" },
    });
  }

  return NextResponse.redirect(`${origin}/?auth_error=${isRecoveryFlow ? "recovery" : "oauth"}`);
}