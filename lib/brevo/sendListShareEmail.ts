import { getBrevoConfig, isBrevoConfigured } from "./config";
import { escapeHtml } from "./emailUtils";
import { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";
import { buildTransactionalHtml } from "./emailLayout";

export type ListShareEmailParams = {
  to: string;
  sharerName: string;
  listTitle: string;
  sourceWorkspaceName: string;
  shareId: string;
};

function buildListShareContent(params: ListShareEmailParams, shareLink: string) {
  const sharerName = escapeHtml(params.sharerName);
  const listTitle = escapeHtml(params.listTitle);
  const sourceWorkspaceName = escapeHtml(params.sourceWorkspaceName);

  return {
    subject: `${params.sharerName} shared "${params.listTitle}" with you`,
    preheader: `From ${params.sourceWorkspaceName} on Badazz Tasks.`,
    sections: [
      {
        heading: "Shared list",
        lead: `${sharerName} shared the list <strong>${listTitle}</strong> from workspace <strong>${sourceWorkspaceName}</strong>.`,
        bodyHtml: `<p style="margin:0;">Choose one of your workspaces to connect this live-linked list.</p>`,
        cta: { label: "View shared list", href: shareLink },
        footnote: `Or copy this link: ${shareLink}`,
      },
    ],
  };
}

export async function sendListShareEmail(
  params: ListShareEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { apiKey, senderEmail, senderName, appBaseUrl, listShareTemplateId } = getBrevoConfig();
  const shareLink = `${appBaseUrl.replace(/\/$/, "")}/list-share/${params.shareId}`;

  const templateId = listShareTemplateId;
  if (templateId && /^\d+$/.test(templateId)) {
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
        subject: `${params.sharerName} shared "${params.listTitle}" with you`,
        templateId: Number(templateId),
        params: {
          sharerName: params.sharerName,
          listTitle: params.listTitle,
          sourceWorkspaceName: params.sourceWorkspaceName,
          shareLink,
        },
        tags: ["list-share", "badazz-tasks"],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[brevo] list share email failed", response.status, detail);
      return { ok: false, reason: `brevo_http_${response.status}` };
    }

    const data = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  }

  return sendBrevoTransactionalEmail({
    to: params.to,
    tags: ["list-share", "badazz-tasks"],
    content: buildListShareContent(params, shareLink),
  });
}

export function buildListShareHtml(params: ListShareEmailParams, shareLink: string): string {
  return buildTransactionalHtml(buildListShareContent(params, shareLink));
}