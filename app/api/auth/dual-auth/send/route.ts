import { NextResponse, type NextRequest } from "next/server";
import {
  DUAL_AUTH_CODE_TTL_MS,
  DUAL_AUTH_MAX_SENDS_PER_WINDOW,
  DUAL_AUTH_SEND_WINDOW_MS,
  generateDualAuthCode,
  hashDualAuthCode,
  isDualAuthEnforced,
  isDualAuthSatisfied,
} from "@/lib/auth/dualAuth";
import { sendDualAuthEmail } from "@/lib/brevo";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isDualAuthEnforced()) {
    return NextResponse.json(
      {
        error:
          "Dual authentication is not fully configured. Set SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, and BREVO_SENDER_EMAIL.",
      },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDualAuthSatisfied(request, user.id)) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const admin = createAdminSupabaseClient();
  const windowStart = new Date(Date.now() - DUAL_AUTH_SEND_WINDOW_MS).toISOString();

  const challenges = admin.from("dual_auth_challenges") as ReturnType<typeof admin.from>;
  const { count, error: countError } = await challenges
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if (countError) {
    const missingTable = countError.message?.toLowerCase().includes("dual_auth_challenges");
    return NextResponse.json(
      {
        error: missingTable
          ? "Dual auth table is missing. Run supabase/add-dual-auth.sql in your Supabase project."
          : "Could not check send rate limit.",
      },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= DUAL_AUTH_MAX_SENDS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many codes requested. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const code = generateDualAuthCode();
  const codeHash = hashDualAuthCode(user.id, code);
  const expiresAt = new Date(Date.now() + DUAL_AUTH_CODE_TTL_MS).toISOString();

  const { error: insertError } = await challenges.insert({
    user_id: user.id,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not create verification challenge." }, { status: 500 });
  }

  const emailResult = await sendDualAuthEmail({ to: user.email, code });
  if (!emailResult.ok) {
    return NextResponse.json(
      { error: "Verification email could not be sent.", reason: emailResult.reason },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, messageId: emailResult.messageId });
}