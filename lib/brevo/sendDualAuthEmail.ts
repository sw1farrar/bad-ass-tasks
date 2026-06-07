import { getBrevoConfig } from "./config";
import { buildTransactionalHtml } from "./emailLayout";
import { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";

export type DualAuthEmailParams = {
  to: string;
  code: string;
};

function buildDualAuthContent(params: DualAuthEmailParams) {
  const appBaseUrl = getBrevoConfig().appBaseUrl.replace(/\/$/, "");

  return {
    subject: `${params.code} is your Badazz Tasks sign-in code`,
    preheader: `Your sign-in code is ${params.code}. It expires in 10 minutes.`,
    sections: [
      {
        heading: "Verify your sign-in",
        lead: "Enter this code to finish signing in. We sent it to your registered email for extra security.",
        code: params.code,
        codeHint: "This code expires in 10 minutes.",
        cta: { label: "Open Badazz Tasks", href: appBaseUrl },
        footnote: "If you did not try to sign in, you can ignore this email.",
      },
    ],
  };
}

export async function sendDualAuthEmail(
  params: DualAuthEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  return sendBrevoTransactionalEmail({
    to: params.to,
    tags: ["dual-auth", "badazz-tasks"],
    content: buildDualAuthContent(params),
  });
}

/** Exported for unit tests. */
export function buildDualAuthHtml(params: DualAuthEmailParams): string {
  return buildTransactionalHtml(buildDualAuthContent(params));
}