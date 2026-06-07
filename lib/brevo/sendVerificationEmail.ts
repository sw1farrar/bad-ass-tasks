import { getBrevoConfig } from "./config";
import { buildTransactionalHtml } from "./emailLayout";
import { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";

export type VerificationEmailParams = {
  to: string;
  code: string;
};

function buildVerificationContent(params: VerificationEmailParams) {
  const appBaseUrl = getBrevoConfig().appBaseUrl.replace(/\/$/, "");

  return {
    subject: `${params.code} is your Badazz Tasks verification code`,
    preheader: `Your verification code is ${params.code}. It expires in 1 hour.`,
    sections: [
      {
        heading: "Verify your email",
        lead: "Enter this code in the app to finish creating your account.",
        code: params.code,
        codeHint: "This code expires in 1 hour.",
        cta: { label: "Open Badazz Tasks", href: appBaseUrl },
        footnote: "If you did not sign up, you can ignore this email.",
      },
    ],
  };
}

export async function sendVerificationEmail(
  params: VerificationEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  return sendBrevoTransactionalEmail({
    to: params.to,
    tags: ["email-verification", "badazz-tasks"],
    content: buildVerificationContent(params),
  });
}

/** Exported for unit tests. */
export function buildVerificationHtml(params: VerificationEmailParams): string {
  return buildTransactionalHtml(buildVerificationContent(params));
}