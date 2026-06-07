import type { Json } from "@/types/supabase";
import type { BrevoInboundEmailItem } from "./inboundTypes";

function collapseWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function stripHtmlToPlainText(html: string): string {
  return collapseWhitespace(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">"),
  );
}

export function formatInboundSenderLine(item: BrevoInboundEmailItem): string {
  const from = item.From;
  if (!from?.Address) return "Unknown sender";
  if (from.Name?.trim()) return `${from.Name.trim()} <${from.Address}>`;
  return from.Address;
}

/** Pick the best available plain-text body from a Brevo inbound item. */
export function extractInboundPlainBody(item: BrevoInboundEmailItem): string {
  const markdown = item.ExtractedMarkdownMessage?.trim();
  if (markdown) return collapseWhitespace(markdown);

  const text = item.RawTextBody?.trim();
  if (text) return collapseWhitespace(text);

  const html = item.RawHtmlBody?.trim();
  if (html) return stripHtmlToPlainText(html);

  return "";
}

export function buildInboundNoteTitle(item: BrevoInboundEmailItem): string {
  const subject = item.Subject?.trim();
  if (subject) return subject.slice(0, 500);
  return `Email from ${formatInboundSenderLine(item)}`.slice(0, 500);
}

export function buildInboundNotePlainText(item: BrevoInboundEmailItem): string {
  const body = extractInboundPlainBody(item);
  const sender = formatInboundSenderLine(item);
  const sentAt = item.SentAtDate?.trim();

  const headerLines = [`From: ${sender}`];
  if (sentAt) headerLines.push(`Sent: ${sentAt}`);

  if (!body) return headerLines.join("\n");
  return `${headerLines.join("\n")}\n\n${body}`;
}

/** Minimal TipTap doc for notes.content JSONB column. */
export function plainTextToTipTapDoc(text: string): Json {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: "doc", content: [{ type: "paragraph" }] } as Json;
  }

  const paragraphs = trimmed.split(/\n{2,}/).map((block) => ({
    type: "paragraph",
    content: [{ type: "text", text: block.replace(/\n/g, " ") }],
  }));

  return { type: "doc", content: paragraphs } as Json;
}

export function buildInboundNoteContentJson(item: BrevoInboundEmailItem): Json {
  return plainTextToTipTapDoc(buildInboundNotePlainText(item));
}