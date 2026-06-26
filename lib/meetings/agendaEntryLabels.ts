import { format, parseISO } from "date-fns";

export function formatAgendaEntryTimestamp(createdAt: string): string {
  return format(parseISO(createdAt), "MMM d, yyyy");
}

export function appendAgendaEntryClipboardPlainText(
  lines: string[],
  body: string,
  createdAt: string,
  indent = "   ",
): void {
  lines.push(`${indent}${body}`);
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
    `<span style="display: block; font-size: ${bodySize}; color: #000000; white-space: pre-wrap; margin: 0 0 2px;">${escapeHtml(body)}</span>` +
    `<br />` +
    `<span style="display: block; font-size: ${metaSize}; color: #000000;">${escapeHtml(timestamp)}</span>`
  );
}