import { getBrevoConfig, isBrevoConfigured } from "./config";
import { escapeHtml } from "./emailUtils";
import { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";
import { buildTransactionalHtml } from "./emailLayout";

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

function buildInviteContent(params: WorkspaceInviteEmailParams, inviteLink: string) {
  const role = roleLabel(params.role);
  const inviterName = escapeHtml(params.inviterName);
  const workspaceName = escapeHtml(params.workspaceName);

  return {
    subject: `${params.inviterName} invited you to ${params.workspaceName}`,
    preheader: `Join ${params.workspaceName} on Badazz Tasks as ${role}.`,
    sections: [
      {
        heading: "You're invited",
        lead: `${inviterName} invited you to join ${workspaceName} as ${role}.`,
        bodyHtml: `<p style="margin:0;">Click below to set your password and jump straight into the workspace.</p>`,
        cta: { label: "Accept invitation", href: inviteLink },
        footnote: `Or copy this link: ${inviteLink}`,
      },
    ],
  };
}

export async function sendWorkspaceInviteEmail(
  params: WorkspaceInviteEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { apiKey, senderEmail, senderName, appBaseUrl, inviteTemplateId } = getBrevoConfig();
  const inviteLink = `${appBaseUrl.replace(/\/$/, "")}/invite/${params.inviteId}`;

  if (inviteTemplateId && /^\d+$/.test(inviteTemplateId)) {
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
        subject: `${params.inviterName} invited you to ${params.workspaceName}`,
        templateId: Number(inviteTemplateId),
        params: {
          inviterName: params.inviterName,
          workspaceName: params.workspaceName,
          inviteLink,
          role: params.role,
        },
        tags: ["workspace-invite", "badazz-tasks"],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[brevo] invite email failed", response.status, detail);
      return { ok: false, reason: `brevo_http_${response.status}` };
    }

    const data = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  }

  return sendBrevoTransactionalEmail({
    to: params.to,
    tags: ["workspace-invite", "badazz-tasks"],
    content: buildInviteContent(params, inviteLink),
  });
}

export function buildInviteHtml(params: WorkspaceInviteEmailParams, inviteLink: string): string {
  return buildTransactionalHtml(buildInviteContent(params, inviteLink));
}