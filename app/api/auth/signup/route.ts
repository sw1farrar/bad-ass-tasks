import { NextResponse } from "next/server";
import { isBrevoConfigured, sendVerificationEmail } from "@/lib/brevo";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

type SignupBody = {
  email?: string;
  password?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Signup verification is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server." },
      { status: 503 },
    );
  }

  if (!isBrevoConfigured()) {
    return NextResponse.json(
      { error: "Email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL." },
      { status: 503 },
    );
  }

  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const password = body.password?.trim() ?? "";

  if (!email || !email.includes("@") || password.length < 6) {
    return NextResponse.json(
      { error: "A valid email and password (min 6 characters) are required." },
      { status: 400 },
    );
  }

  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
  });

  if (error) {
    const message = error.message || "Could not create account.";
    const status = message.toLowerCase().includes("already") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  const otp = data?.properties?.email_otp;
  if (!otp) {
    return NextResponse.json({ error: "Could not generate verification code." }, { status: 500 });
  }

  const emailResult = await sendVerificationEmail({ to: email, code: otp });
  if (!emailResult.ok) {
    return NextResponse.json(
      { error: "Account created but verification email could not be sent.", reason: emailResult.reason },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: emailResult.messageId,
    needsVerification: true,
  });
}