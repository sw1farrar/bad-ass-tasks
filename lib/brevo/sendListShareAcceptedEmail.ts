import { getBrevoConfig, isBrevoConfigured } from "./config";
import { escapeHtml } from "./emailUtils";
import { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";
import { buildTransactionalHtml } from "./emailLayout";

export type ListShareAcceptedEmailParams = {
  to: string;
  sharerName: string;
  listTitle: string;
  sourceWorkspaceName: string;
  targetWorkspaceName: string;
  listId: string;
  targetWorkspaceId: string;
};

function buildAcceptedContent(params: ListShareAcceptedEmailParams, openLink: string) {
  const sharerName = escapeHtml(params.sharerName);
  const listTitle = escapeHtml(params.listTitle);
  const sourceWorkspaceName = escapeHtml(params.sourceWorkspaceName);
  const targetWorkspaceName = escapeHtml(params.targetWorkspaceName);

  return {
    subject: `You're now connected to "${params.listTitle}"`,
    preheader: `Added to ${params.targetWorkspaceName} on Badazz Tasks.`,
    sections: [
      {
        heading: "List share accepted",
        lead: `You connected <strong>${listTitle}</strong> from <strong>${sourceWorkspaceName}</strong> into workspace <strong>${targetWorkspaceName}</strong>.`,
        bodyHtml: `<p style="margin:0;">Shared by ${sharerName}. Open it anytime from your Lists view.</p>`,
        cta: { label: "Open list", href: openLink },
        footnote: `Or copy this link: ${openLink}`,
      },
    ],
  };
}

export async function sendListShareAcceptedEmail(
  params: ListShareAcceptedEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; reason: string }> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { appBaseUrl, listShareAcceptedTemplateId, apiKey, senderEmail, senderName } = getBrevoConfig();
  const openLink = `${appBaseUrl.replace(/\/$/, "")}/?view=lists&workspace=${params.targetWorkspaceId}&highlightList=${params.listId}`;

  const templateId = listShareAcceptedTemplateId;
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
        subject: `You're now connected to "${params.listTitle}"`,
        templateId: Number(templateId),
        params: {
          sharerName: params.sharerName,
          listTitle: params.listTitle,
          sourceWorkspaceName: params.sourceWorkspaceName,
          targetWorkspaceName: params.targetWorkspaceName,
          openLink,
        },
        tags: ["list-share-accepted", "badazz-tasks"],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[brevo] list share accepted email failed", response.status, detail);
      return { ok: false, reason: `brevo_http_${response.status}` };
    }

    const data = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  }

  return sendBrevoTransactionalEmail({
    to: params.to,
    tags: ["list-share-accepted", "badazz-tasks"],
    content: buildAcceptedContent(params, openLink),
  });
}

export function buildListShareAcceptedHtml(params: ListShareAcceptedEmailParams, openLink: string): string {
  return buildTransactionalHtml(buildAcceptedContent(params, openLink));
}