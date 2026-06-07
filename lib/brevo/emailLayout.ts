import { escapeHtml } from "./emailUtils";
import { getBrevoConfig } from "./config";

export type TransactionalEmailSection = {
  heading: string;
  lead?: string;
  bodyHtml?: string;
  code?: string;
  codeHint?: string;
  cta?: { label: string; href: string };
  footnote?: string;
};

export type TransactionalEmailContent = {
  subject: string;
  preheader?: string;
  sections: TransactionalEmailSection[];
};

function buildPlainSection(section: TransactionalEmailSection): string[] {
  const lines: string[] = [section.heading];
  if (section.lead) lines.push(section.lead);
  if (section.code) {
    lines.push("");
    lines.push(section.code);
    if (section.codeHint) lines.push(section.codeHint);
  }
  if (section.bodyHtml) {
    lines.push(stripHtml(section.bodyHtml));
  }
  if (section.cta) {
    lines.push("");
    lines.push(`${section.cta.label}: ${section.cta.href}`);
  }
  if (section.footnote) lines.push(section.footnote);
  return lines;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildTransactionalPlainText(content: TransactionalEmailContent): string {
  const appName = getBrevoConfig().senderName || "Badazz Tasks";
  const appUrl = getBrevoConfig().appBaseUrl.replace(/\/$/, "");
  const lines: string[] = [];

  if (content.preheader) lines.push(content.preheader, "");

  for (const section of content.sections) {
    lines.push(...buildPlainSection(section), "");
  }

  lines.push("—", appName, appUrl);
  return lines.join("\n").trim();
}

export function buildTransactionalHtml(content: TransactionalEmailContent): string {
  const appName = escapeHtml(getBrevoConfig().senderName || "Badazz Tasks");
  const appUrl = escapeHtml(getBrevoConfig().appBaseUrl.replace(/\/$/, ""));
  const preheader = content.preheader ? escapeHtml(content.preheader) : "";

  const sectionsHtml = content.sections
    .map((section) => {
      const heading = escapeHtml(section.heading);
      const lead = section.lead ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#52525b;">${escapeHtml(section.lead)}</p>` : "";
      const body = section.bodyHtml
        ? `<div style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#3f3f46;">${section.bodyHtml}</div>`
        : "";
      const codeBlock = section.code
        ? `<div style="margin:20px 0 0;text-align:center;">
            <div style="display:inline-block;padding:16px 24px;border-radius:12px;background-color:#f5f3ff;border:1px solid #e9d5ff;">
              <span style="font-size:28px;font-weight:600;letter-spacing:0.24em;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(section.code)}</span>
            </div>
            ${section.codeHint ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#71717a;">${escapeHtml(section.codeHint)}</p>` : ""}
          </div>`
        : "";
      const cta = section.cta
        ? `<div style="margin:24px 0 0;text-align:center;">
            <a href="${escapeHtml(section.cta.href)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background-color:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${escapeHtml(section.cta.label)}</a>
          </div>`
        : "";
      const footnote = section.footnote
        ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#71717a;">${escapeHtml(section.footnote)}</p>`
        : "";

      return `<tr>
        <td style="padding:28px 32px 8px;">
          <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#18181b;line-height:1.25;">${heading}</h1>
          ${lead}
          ${body}
          ${codeBlock}
          ${cta}
          ${footnote}
        </td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px 8px;border-bottom:1px solid #f4f4f5;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.03em;color:#7c3aed;">${appName}</p>
            </td>
          </tr>
          ${sectionsHtml}
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">Get shit done. Beautifully.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
                <a href="${appUrl}" style="color:#7c3aed;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}