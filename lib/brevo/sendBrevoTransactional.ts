import { getBrevoConfig, isBrevoConfigured } from "./config";
import {
  buildTransactionalHtml,
  buildTransactionalPlainText,
  type TransactionalEmailContent,
} from "./emailLayout";

export type BrevoSendResult = { ok: true; messageId?: string } | { ok: false; reason: string };

export async function sendBrevoTransactionalEmail(params: {
  to: string;
  content: TransactionalEmailContent;
  tags: string[];
}): Promise<BrevoSendResult> {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: "brevo_not_configured" };
  }

  const { apiKey, senderEmail, senderName } = getBrevoConfig();
  const htmlContent = buildTransactionalHtml(params.content);
  const textContent = buildTransactionalPlainText(params.content);

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
      subject: params.content.subject,
      htmlContent,
      textContent,
      tags: params.tags,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[brevo] transactional email failed", response.status, detail);
    return { ok: false, reason: `brevo_http_${response.status}` };
  }

  const data = (await response.json().catch(() => ({}))) as { messageId?: string };
  return { ok: true, messageId: data.messageId };
}