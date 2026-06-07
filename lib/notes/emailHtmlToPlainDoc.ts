import type { Json } from "@/types/supabase";
import { stripHtmlToPlainText } from "@/lib/brevo/inboundNoteContent";

/** True when HTML is simple enough to replace the email block with editable paragraphs. */
export function isSimpleEmailHtml(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed) return true;

  const tableCount = (trimmed.match(/<table\b/gi) ?? []).length;
  const imgCount = (trimmed.match(/<img\b/gi) ?? []).length;
  if (tableCount > 0 || imgCount > 0) return false;

  const text = stripHtmlToPlainText(trimmed);
  return text.length < 4000;
}

/** TipTap paragraphs from email HTML (for "Convert to editable text"). */
export function emailHtmlToEditableDoc(html: string): Json {
  const text = stripHtmlToPlainText(html);
  if (!text) {
    return { type: "doc", content: [{ type: "paragraph" }] } as Json;
  }

  const paragraphs = text.split(/\n{2,}/).map((block) => ({
    type: "paragraph",
    content: [{ type: "text", text: block.replace(/\n/g, " ") }],
  }));

  return { type: "doc", content: paragraphs } as Json;
}