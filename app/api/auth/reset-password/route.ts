import { NextResponse } from "next/server";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { sendRecoveryCode } from "@/lib/auth/sendRecoveryCode";
import { checkRateLimit } from "@/lib/auth/rateLimit";

type ResetPasswordBody = {
  email?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  let body: ResetPasswordBody;
  try {
    body = (await request.json()) as ResetPasswordBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const rate = checkRateLimit(`reset-password:${email}`, 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many reset attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const result = await sendRecoveryCode(email);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }

  await logAuthLoginEventFromRequest(request, {
    eventType: "password_reset_requested",
    userId: result.userId ?? null,
    email,
    authMethod: "otp_recovery",
    metadata: { sent: result.sent },
  });

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    messageId: result.messageId,
  });
}