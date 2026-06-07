import { getBrevoConfig, isBrevoConfigured } from "./config";
import { escapeHtml } from "./emailUtils";

export type WorkspaceInviteEmailParams = {
  to: string;
  inviterName: string;
  workspaceName: string;
  inviteId: string;
  role: string;
};

function roleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "owner") return "Owner";
  return "Member";
}

function buildInviteHtml(params: WorkspaceInviteEmailParams, inviteLink: string): string {
  const role = roleLabel(params.role);
  const inviterName = escapeHtml(params.inviterName);
  const workspaceName = escapeHtml(params.workspaceName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Join ${workspaceName} on Badazz Tasks</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#111114;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(180deg,rgba(192,132,252,0.14) 0%,rgba(17,17,20,0) 100%);">
              <div style="display:inline-block;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#c084fc 0%,#a855f7 100%);line-height:44px;font-size:20px;font-weight:700;color:#0a0a0f;">✓</div>
              <p style="margin:16px 0 4px;font-size:13px;letter-spacing:0.04em;color:#c084fc;">Badazz Tasks</p>
              <h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#f4f4f5;line-height:1.2;">You&apos;re invited</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
                <strong style="color:#f4f4f5;">${inviterName}</strong> invited you to join
                <strong style="color:#f4f4f5;">${workspaceName}</strong> as
                <strong style="color:#f4f4f5;">${role}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;text-align:center;">
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#a1a1aa;">
                Click below to set your password and jump straight into the workspace.
              </p>
              <a href="${inviteLink}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#c084fc 0%,#a855f7 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:600;">
                Accept invitation
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
                Or copy this link:<br />
                <a href="${inviteLink}" style="color:#c084fc;text-decoration:none;word-break:break-all;">${inviteLink}</a>
              </p>
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

export async function sendWorkspaceInviteEmail(
  params: WorkspaceInviteEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { apiKey, senderEmail, senderName, appBaseUrl, inviteTemplateId } = getBrevoConfig();
  const inviteLink = `${appBaseUrl.replace(/\/$/, "")}/invite/${params.inviteId}`;
  const subject = `${params.inviterName} invited you to ${params.workspaceName}`;

  const payload: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: params.to }],
    subject,
    tags: ["workspace-invite", "badazz-tasks"],
  };

  if (inviteTemplateId && /^\d+$/.test(inviteTemplateId)) {
    payload.templateId = Number(inviteTemplateId);
    payload.params = {
      inviterName: params.inviterName,
      workspaceName: params.workspaceName,
      inviteLink,
      role: params.role,
    };
  } else {
    payload.htmlContent = buildInviteHtml(params, inviteLink);
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[brevo] invite email failed", response.status, detail);
    return { ok: false, reason: `brevo_http_${response.status}` };
  }

  const data = (await response.json().catch(() => ({}))) as { messageId?: string };
  return { ok: true, messageId: data.messageId };
}

export { buildInviteHtml };