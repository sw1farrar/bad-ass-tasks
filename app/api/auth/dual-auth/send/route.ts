import { NextResponse, type NextRequest } from "next/server";
import {
  DUAL_AUTH_CODE_TTL_MS,
  DUAL_AUTH_SEND_WINDOW_MS,
  generateDualAuthCode,
  hashDualAuthCode,
  isDualAuthEnforced,
  isDualAuthSatisfied,
} from "@/lib/auth/dualAuth";
import {
  createDualAuthChallengeAtomic,
  fetchActiveDualAuthChallenge,
  retryAfterForActiveChallenge,
} from "@/lib/auth/dualAuthChallenges";
import { decideDualAuthSend } from "@/lib/auth/dualAuthSendPolicy";
import { sendDualAuthEmail } from "@/lib/brevo";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SendBody = {
  force?: boolean;
  confirm?: boolean;
};

function isMissingAtomicRpc(error: unknown): boolean {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? "";
  return message.includes("create_dual_auth_challenge_atomic");
}

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

  let force = false;
  let confirm = false;
  try {
    const body = (await request.json()) as SendBody;
    force = body?.force === true;
    confirm = body?.confirm === true;
  } catch {
    return NextResponse.json(
      { error: "Confirmation is required before sending a verification code." },
      { status: 400 },
    );
  }

  if (!force && !confirm) {
    return NextResponse.json(
      { error: "Confirmation is required before sending a verification code." },
      { status: 400 },
    );
  }

  const admin = createAdminSupabaseClient();
  const challenges = admin.from("dual_auth_challenges") as ReturnType<typeof admin.from>;
  const windowStart = new Date(Date.now() - DUAL_AUTH_SEND_WINDOW_MS).toISOString();

  try {
    const [active, countResult] = await Promise.all([
      fetchActiveDualAuthChallenge(admin as never, user.id),
      challenges
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", windowStart),
    ]);

    if (countResult.error) {
      const missingTable = countResult.error.message?.toLowerCase().includes("dual_auth_challenges");
      return NextResponse.json(
        {
          error: missingTable
            ? "Dual auth table is missing. Run supabase/add-dual-auth.sql in your Supabase project."
            : "Could not check verification send limits.",
        },
        { status: 500 },
      );
    }

    const decision = decideDualAuthSend({
      force,
      recentChallengeCreatedAt: active?.created_at ?? null,
      sendsInWindow: countResult.count ?? 0,
    });

    if (decision.action === "already_sent") {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }

    if (decision.action === "cooldown") {
      return NextResponse.json(
        {
          error: "Please wait before requesting a new code.",
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    if (decision.action === "rate_limited") {
      return NextResponse.json(
        { error: "Too many codes requested. Wait a few minutes and try again." },
        { status: 429 },
      );
    }

    const code = generateDualAuthCode();
    const codeHash = hashDualAuthCode(user.id, code);
    const expiresAt = new Date(Date.now() + DUAL_AUTH_CODE_TTL_MS).toISOString();

    try {
      const atomicResult = await createDualAuthChallengeAtomic(admin as never, {
        userId: user.id,
        codeHash,
        expiresAt,
        force,
      });

      if (atomicResult.action === "already_sent") {
        return NextResponse.json({
          ok: true,
          alreadySent: true,
          retryAfterSeconds: atomicResult.retryAfterSeconds,
        });
      }

      if (atomicResult.action === "cooldown") {
        return NextResponse.json(
          {
            error: "Please wait before requesting a new code.",
            retryAfterSeconds: atomicResult.retryAfterSeconds,
          },
          { status: 429 },
        );
      }

      if (atomicResult.action === "rate_limited") {
        return NextResponse.json(
          { error: "Too many codes requested. Wait a few minutes and try again." },
          { status: 429 },
        );
      }
    } catch (rpcError) {
      if (!isMissingAtomicRpc(rpcError)) {
        return NextResponse.json({ error: "Could not create verification challenge." }, { status: 500 });
      }

      const { error: insertError } = await challenges.insert({
        user_id: user.id,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

      if (insertError) {
        return NextResponse.json({ error: "Could not create verification challenge." }, { status: 500 });
      }
    }

    const emailResult = await sendDualAuthEmail({ to: user.email, code });
    if (!emailResult.ok) {
      await challenges.delete().eq("user_id", user.id).eq("code_hash", codeHash);
      return NextResponse.json(
        { error: "Verification email could not be sent.", reason: emailResult.reason },
        { status: 502 },
      );
    }

    const activeAfter = await fetchActiveDualAuthChallenge(admin as never, user.id);
    return NextResponse.json({
      ok: true,
      messageId: emailResult.messageId,
      retryAfterSeconds: retryAfterForActiveChallenge(activeAfter),
    });
  } catch {
    return NextResponse.json({ error: "Could not send verification code." }, { status: 500 });
  }
}