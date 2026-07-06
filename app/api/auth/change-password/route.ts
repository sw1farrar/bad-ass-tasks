import { NextResponse } from "next/server";
import { logAuthLoginEventFromRequest } from "@/lib/auth/loginEvents";
import { formatPasswordUpdateError } from "@/lib/auth/passwordUpdateErrors";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { userHasEmailPassword } from "@/lib/auth/userAuthProviders";
import { verifyUserPassword } from "@/lib/auth/verifyUserPassword";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

const MIN_PASSWORD_LENGTH = 6;
const GENERIC_CURRENT_PASSWORD_ERROR = "Current password is incorrect.";

export async function POST(request: Request) {
  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const newPassword = body.newPassword ?? "";
  const currentPassword = body.currentPassword ?? "";

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
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

  const rate = checkRateLimit(`change-password:${user.id}`, 8, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many password change attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const requiresCurrentPassword = userHasEmailPassword(user);
  if (requiresCurrentPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }

    const currentOk = await verifyUserPassword(user.email, currentPassword);
    if (!currentOk) {
      return NextResponse.json({ error: GENERIC_CURRENT_PASSWORD_ERROR }, { status: 401 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 },
      );
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    const message = formatPasswordUpdateError(updateError.message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await logAuthLoginEventFromRequest(request, {
    eventType: "password_changed",
    userId: user.id,
    email: user.email,
    authMethod: "password",
    metadata: { hadEmailPassword: requiresCurrentPassword },
  });

  return NextResponse.json({ ok: true });
}
