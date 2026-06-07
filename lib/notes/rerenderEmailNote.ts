import type { Json } from "@/types/supabase";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";
import { buildInboundNoteContentJson } from "@/lib/notes/emailHtmlToTipTap";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";
import { buildNoteAttachmentFileUrl } from "@/lib/notes/attachmentUrls";

type AttachmentRow = {
  content_id: string | null;
  id: string;
};

function normalizeCid(value: string): string {
  return value.replace(/^<|>$/g, "").trim().toLowerCase();
}

export function buildCidMapFromAttachmentsForNote(
  noteId: string,
  attachments: AttachmentRow[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const att of attachments) {
    const raw = att.content_id?.trim();
    if (!raw) continue;
    const url = buildNoteAttachmentFileUrl(noteId, att.id);
    const key = normalizeCid(raw);
    map[key] = url;
    const bare = raw.replace(/^<|>$/g, "").trim();
    if (bare) map[bare] = url;
  }
  return map;
}

export function rerenderEmailNoteContent(params: {
  item: Pick<BrevoInboundEmailItem, "From" | "SentAtDate" | "RawHtmlBody">;
  rawHtml: string;
  cidToUrl?: Record<string, string>;
}): { content: Json; searchPlain: string; pipelineVersion: number } {
  const syntheticItem: BrevoInboundEmailItem = {
    ...params.item,
    RawHtmlBody: params.rawHtml,
  };

  const content = buildInboundNoteContentJson(syntheticItem, params.cidToUrl);
  const searchPlain = extractNoteSearchText(content);

  return {
    content,
    searchPlain,
    pipelineVersion: EMAIL_PIPELINE_VERSION,
  };
}