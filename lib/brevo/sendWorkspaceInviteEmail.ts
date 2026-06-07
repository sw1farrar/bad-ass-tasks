import { getBrevoConfig, isBrevoConfigured } from "./config";

export type WorkspaceInviteEmailParams = {
  to: string;
  inviterName: string;
  workspaceName: string;
  inviteId: string;
  role: string;
};

function buildInviteHtml(params: WorkspaceInviteEmailParams, inviteLink: string): string {
  const roleLabel = params.role === "admin" ? "Admin" : params.role === "owner" ? "Owner" : "Member";
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111;">
    <p>Hi,</p>
    <p>
      <strong>${escapeHtml(params.inviterName)}</strong> invited you to join
      <strong>${escapeHtml(params.workspaceName)}</strong> on Badazz Tasks as
      <strong>${roleLabel}</strong>.
    </p>
    <p>
      <a href="${inviteLink}" style="display: inline-block; padding: 12px 20px; background: #a855f7; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600;">
        Accept invitation
      </a>
    </p>
    <p style="color: #666; font-size: 14px;">
      Or copy this link:<br />
      <a href="${inviteLink}">${inviteLink}</a>
    </p>
    <p style="color: #888; font-size: 12px;">— Badazz Tasks</p>
  </body>
</html>`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWorkspaceInviteEmail(
  params: WorkspaceInviteEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { apiKey, senderEmail, senderName, appBaseUrl, inviteTemplateId } = getBrevoConfig();
  const inviteLink = `${appBaseUrl.replace(/\/$/, "")}/?invite=${params.inviteId}`;
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