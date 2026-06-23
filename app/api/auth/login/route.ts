import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { logDualAuthRequiredIfNeeded } from "@/lib/auth/logDualAuthEvents";
import { resolveDualAuthStatus } from "@/lib/auth/dualAuthStatus";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/auth/clientIp";

type LoginBody = {
  email?: string;
  password?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const password = body.password ?? "";

  if (!email || !email.includes("@") || password.length < 6) {
    if (email) {
      await logAuthLoginEventFromRequest(request, {
        eventType: "login_failed",
        email,
        authMethod: "password",
        metadata: { reason: "invalid_request" },
      });
    }
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 400 });
  }

  const ip = getClientIp(request) ?? "unknown";
  const rate = checkRateLimit(`login:${ip}:${email}`, 12, 15 * 60 * 1000);
  if (!rate.allowed) {
    await logAuthLoginEventFromRequest(request, {
      eventType: "login_failed",
      email,
      authMethod: "password",
      metadata: { reason: "rate_limited" },
    });
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const needsVerify = /not confirmed|confirm your email/i.test(error?.message ?? "");
    if (needsVerify) {
      await logAuthLoginEventFromRequest(request, {
        eventType: "login_failed",
        email,
        authMethod: "password",
        metadata: { reason: "email_unverified" },
      });
      return NextResponse.json(
        { error: "Please verify your email before signing in.", needsVerification: true },
        { status: 403 },
      );
    }

    await logAuthLoginEventFromRequest(request, {
      eventType: "login_failed",
      email,
      authMethod: "password",
      metadata: { reason: "invalid_credentials" },
    });
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  if (!data.session) {
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }

  const dualAuth = await resolveDualAuthStatus(
    request,
    data.user.id,
    data.user.email ?? email,
  );

  const dualAuthPending = dualAuth.enforced && dualAuth.required && !dualAuth.verified;

  await logAuthLoginEventFromRequest(request, {
    eventType: "login_success",
    userId: data.user.id,
    email: data.user.email ?? email,
    authMethod: "password",
    metadata: dualAuthPending ? { dualAuthPending: true } : undefined,
  });

  await logDualAuthRequiredIfNeeded(request, data.user.id, data.user.email ?? email, dualAuth);

  return NextResponse.json({
    ok: true,
    dualAuth,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}