import { getBrevoConfig, isBrevoConfigured, sendPasswordResetEmail } from "@/lib/brevo";
import { buildRecoveryCallbackUrl } from "@/lib/auth/recoverySession";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type SendRecoveryCodeResult =
  | { ok: true; sent: boolean; messageId?: string; userId?: string }
  | { ok: false; reason: string; status: number };

function isUserNotFoundError(message: string): boolean {
  return /not found|no user|not registered|does not exist/i.test(message);
}

export async function sendRecoveryCode(email: string): Promise<SendRecoveryCodeResult> {
  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      reason: "Password reset is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
      status: 503,
    };
  }

  if (!isBrevoConfigured()) {
    return {
      ok: false,
      reason: "Email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.",
      status: 503,
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const appBaseUrl = getBrevoConfig().appBaseUrl;
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: {
      redirectTo: buildRecoveryCallbackUrl(appBaseUrl),
    },
  });

  if (error) {
    const message = error.message || "Could not send reset code.";
    if (isUserNotFoundError(message)) {
      return { ok: true, sent: false };
    }
    console.error("[auth] recovery generateLink failed", message);
    return { ok: false, reason: message, status: 400 };
  }

  const otp = data?.properties?.email_otp?.trim();
  if (!otp) {
    console.error("[auth] recovery generateLink returned no email_otp");
    return { ok: false, reason: "Could not generate reset code.", status: 500 };
  }

  const resetLink = data?.properties?.action_link?.trim();
  const emailResult = await sendPasswordResetEmail({
    to: normalizedEmail,
    code: otp,
    resetLink: resetLink || undefined,
  });

  if (!emailResult.ok) {
    console.error("[auth] password reset email failed", emailResult.reason);
    return {
      ok: false,
      reason: "Reset code could not be sent. Try again in a few minutes.",
      status: 502,
    };
  }

  const userId = data?.user?.id?.trim() || undefined;

  return { ok: true, sent: true, messageId: emailResult.messageId, userId };
}