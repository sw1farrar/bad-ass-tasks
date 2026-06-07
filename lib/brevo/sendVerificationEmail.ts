import { getBrevoConfig, isBrevoConfigured } from "./config";
import { escapeHtml } from "./emailUtils";

export type VerificationEmailParams = {
  to: string;
  code: string;
};

function buildVerificationHtml(params: VerificationEmailParams): string {
  const code = escapeHtml(params.code);
  const appBaseUrl = getBrevoConfig().appBaseUrl.replace(/\/$/, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Verify your email — Badazz Tasks</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#111114;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(180deg,rgba(192,132,252,0.14) 0%,rgba(17,17,20,0) 100%);">
              <div style="display:inline-block;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#c084fc 0%,#a855f7 100%);line-height:44px;font-size:20px;font-weight:700;color:#0a0a0f;">✓</div>
              <p style="margin:16px 0 4px;font-size:13px;letter-spacing:0.04em;color:#c084fc;">Badazz Tasks</p>
              <h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#f4f4f5;line-height:1.2;">Verify your email</h1>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#a1a1aa;">Enter this code in the app to finish creating your account.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;text-align:center;">
              <div style="display:inline-block;padding:18px 28px;border-radius:16px;background-color:rgba(192,132,252,0.08);border:1px solid rgba(192,132,252,0.25);">
                <span style="font-size:32px;font-weight:600;letter-spacing:0.28em;color:#f4f4f5;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${code}</span>
              </div>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#71717a;">This code expires in 1 hour. If you didn&apos;t sign up, you can ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${escapeHtml(appBaseUrl)}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:linear-gradient(135deg,#c084fc 0%,#a855f7 100%);color:#0a0a0f;text-decoration:none;font-size:14px;font-weight:600;">Open Badazz Tasks</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;font-size:12px;color:#52525b;line-height:1.5;">Get shit done. Beautifully.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function sendVerificationEmail(
  params: VerificationEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { apiKey, senderEmail, senderName } = getBrevoConfig();
  const subject = `${params.code} is your Badazz Tasks verification code`;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: params.to }],
      subject,
      htmlContent: buildVerificationHtml(params),
      tags: ["email-verification", "badazz-tasks"],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[brevo] verification email failed", response.status, detail);
    return { ok: false, reason: `brevo_http_${response.status}` };
  }

  const data = (await response.json().catch(() => ({}))) as { messageId?: string };
  return { ok: true, messageId: data.messageId };
}

/** Exported for unit tests. */
export { buildVerificationHtml };