import { getBrevoConfig } from "./config";
import { buildTransactionalHtml } from "./emailLayout";
import { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";

export type PasswordResetEmailParams = {
  to: string;
  code: string;
  /** Supabase recovery magic link — fallback when the numeric code is hard to find. */
  resetLink?: string;
};

function buildPasswordResetContent(params: PasswordResetEmailParams) {
  const appBaseUrl = getBrevoConfig().appBaseUrl.replace(/\/$/, "");
  const loginUrl = `${appBaseUrl}/login?mode=reset-verify`;

  const sections: Parameters<typeof buildTransactionalHtml>[0]["sections"] = [
    {
      heading: "Reset your password",
      lead: "Enter this code on the sign-in page to choose a new password.",
      code: params.code,
      codeHint: "Codes are 6–8 digits and expire in 1 hour. Check spam if you do not see this email.",
      cta: { label: "Open sign-in page", href: loginUrl },
      footnote: "If you did not request a password reset, you can ignore this email.",
    },
  ];

  if (params.resetLink) {
    sections.push({
      heading: "Prefer a one-click reset?",
      lead: "This secure link signs you in to choose a new password — no code required.",
      cta: { label: "Reset password now", href: params.resetLink },
    });
  }

  return {
    subject: `${params.code} is your Badazz Tasks recovery code`,
    preheader: `Your recovery code is ${params.code}. It expires in 1 hour.`,
    sections,
  };
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  return sendBrevoTransactionalEmail({
    to: params.to,
    tags: ["password-reset", "badazz-tasks"],
    content: buildPasswordResetContent(params),
  });
}

/** Exported for unit tests. */
export function buildPasswordResetHtml(params: PasswordResetEmailParams): string {
  return buildTransactionalHtml(buildPasswordResetContent(params));
}