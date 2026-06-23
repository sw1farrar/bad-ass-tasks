import { NextResponse, type NextRequest } from "next/server";
import {
  hashDualAuthCode,
  isDualAuthEnforced,
  isDualAuthSatisfied,
  setDualAuthCookie,
} from "@/lib/auth/dualAuth";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rateLimit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type VerifyBody = {
  code?: string;
  rememberDevice?: boolean;
};

export async function POST(request: NextRequest) {
  if (!isDualAuthEnforced()) {
    return NextResponse.json(
      { error: "Dual authentication is not fully configured on the server." },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDualAuthSatisfied(request, user.id)) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const rateKey = `dual-auth-verify:${user.id}`;
  const rate = checkRateLimit(rateKey, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    await logAuthLoginEventFromRequest(request, {
      eventType: "dual_auth_failed",
      userId: user.id,
      email: user.email,
      metadata: { reason: "rate_limited", codeEntered: false },
    });
    return NextResponse.json(
      { error: "Too many verification attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = body.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const codeHash = hashDualAuthCode(user.id, code);
  const nowIso = new Date().toISOString();

  const challenges = admin.from("dual_auth_challenges") as ReturnType<typeof admin.from>;
  const { data: challenge, error: lookupError } = await challenges
    .select("id")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Could not verify code." }, { status: 500 });
  }

  if (!challenge) {
    await logAuthLoginEventFromRequest(request, {
      eventType: "dual_auth_failed",
      userId: user.id,
      email: user.email,
      metadata: { reason: "invalid_or_expired_code", codeEntered: true },
    });
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  const { error: consumeError } = await challenges
    .update({ consumed_at: nowIso })
    .eq("id", (challenge as { id: string }).id);

  if (consumeError) {
    return NextResponse.json({ error: "Could not finalize verification." }, { status: 500 });
  }

  const response = NextResponse.json({
    ok: true,
    rememberDevice: !!body.rememberDevice,
  });
  setDualAuthCookie(response, user.id, !!body.rememberDevice);
  resetRateLimit(rateKey);
  await logAuthLoginEventFromRequest(request, {
    eventType: "dual_auth_verified",
    userId: user.id,
    email: user.email,
    metadata: { rememberDevice: !!body.rememberDevice },
  });
  return response;
}