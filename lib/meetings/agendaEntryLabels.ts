import { format, parseISO } from "date-fns";

export function formatAgendaEntryTimestamp(createdAt: string): string {
  return format(parseISO(createdAt), "MMM d, yyyy");
}

/** Preserve line breaks and blank lines when copying plain text. */
export function appendIndentedPlainTextBlock(
  lines: string[],
  text: string,
  indent: string,
): void {
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    lines.push(`${indent}${line}`);
  }
}

/** Word and email paste ignore pre-wrap — use explicit breaks instead. */
export function formatClipboardHtmlText(
  text: string,
  escapeHtml: (value: string) => string,
): string {
  return escapeHtml(text.replace(/\r\n/g, "\n")).replace(/\n/g, "<br />");
}

export function appendAgendaEntryClipboardPlainText(
  lines: string[],
  body: string,
  createdAt: string,
  indent = "   ",
): void {
  appendIndentedPlainTextBlock(lines, body, indent);
  lines.push(`${indent}${formatAgendaEntryTimestamp(createdAt)}`);
}

export function buildAgendaEntryClipboardHtml(
  body: string,
  createdAt: string,
  escapeHtml: (text: string) => string,
  options?: { bodyFontSize?: string; metaFontSize?: string },
): string {
  const bodySize = options?.bodyFontSize ?? "10pt";
  const metaSize = options?.metaFontSize ?? "9pt";
  const timestamp = formatAgendaEntryTimestamp(createdAt);
  return (
    `<span style="display: block; font-size: ${bodySize}; color: #000000; margin: 0 0 2px;">${formatClipboardHtmlText(body, escapeHtml)}</span>` +
    `<br />` +
    `<span style="display: block; font-size: ${metaSize}; color: #000000;">${escapeHtml(timestamp)}</span>`
  );
}