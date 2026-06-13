import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getBrevoInboundDomain } from "./inboundConfig";
import { buildInboundNoteTitle } from "./inboundNoteContent";
import { safeBuildInboundNoteContentJson } from "@/lib/notes/emailHtmlToTipTap";
import { downloadBrevoInboundEml } from "./downloadInboundEml";
import { storeInboundEml } from "@/lib/storage/inboundEml";
import { finalizeInboundNoteContent } from "./finalizeInboundNote";
import { parseInboundRecipientLocalPart } from "./parseInboundRecipient";
import { downloadBrevoInboundAttachment } from "./downloadInboundAttachment";
import { listInboundAttachments } from "./normalizeInboundAttachments";
import { uploadNoteAttachment } from "@/lib/storage/noteAttachments";
import { buildNoteAttachmentFileUrl } from "@/lib/notes/attachmentUrls";
import {
  refreshNoteSearchDocument,
  saveAttachmentExtractedText,
} from "@/lib/notes/refreshNoteSearchDocument";
import { extractPdfText, isPdfMimeType } from "@/lib/pdf/extractPdfText";
import { processInboundTaskEmail } from "./processInboundTaskEmail";
import { fanoutNoteAddedNotifications } from "@/lib/notifications/fanoutNoteAdded";
import type { BrevoInboundAttachment, BrevoInboundEmailItem, BrevoInboundWebhookPayload } from "./inboundTypes";

export type ProcessInboundEmailResult =
  | { ok: true; status: "created"; noteId?: string; taskId?: string; inboxId: string; localPart: string; kind: "note" | "task" }
  | { ok: true; status: "duplicate"; noteId?: string | null; taskId?: string | null; messageId: string; kind?: "note" | "task" }
  | { ok: true; status: "ignored"; reason: string }
  | { ok: false; reason: string };

type NoteEmailInboxRow = {
  id: string;
  workspace_id: string;
  parent_note_id: string | null;
  local_part: string;
  created_by: string | null;
  is_active: boolean;
};

function firstInboundItem(payload: BrevoInboundWebhookPayload): BrevoInboundEmailItem | null {
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0] ?? null;
}

function resolveMessageId(item: BrevoInboundEmailItem): string | null {
  const direct = item.MessageId?.trim();
  if (direct) return direct;
  const uuid = item.Uuid?.[0]?.trim();
  if (uuid) return uuid;
  return null;
}

function normalizeCid(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.replace(/^<|>$/g, "").trim().toLowerCase() || null;
}

async function recordInboundEvent(params: {
  messageId: string;
  inboxId: string;
  noteId: string | null;
  localPart: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await (supabase.from("inbound_email_events") as any).insert({
    message_id: params.messageId,
    inbox_id: params.inboxId,
    note_id: params.noteId,
    local_part: params.localPart,
  });
}

async function processAttachments(params: {
  item: BrevoInboundEmailItem;
  noteId: string;
  workspaceId: string;
  createdBy: string | null;
}): Promise<{ cidToUrl: Record<string, string>; storedCount: number }> {
  const attachments = listInboundAttachments(params.item);
  if (!attachments.length) {
    const rawCount = params.item.Attachments?.length ?? 0;
    if (rawCount > 0) {
      console.warn(
        "[brevo-inbound] attachments present in payload but none had Name + DownloadToken",
        { noteId: params.noteId, rawCount },
      );
    }
    return { cidToUrl: {}, storedCount: 0 };
  }

  const cidToUrl: Record<string, string> = {};
  let storedCount = 0;

  for (const att of attachments) {
    try {
      const { buffer, contentType } = await downloadBrevoInboundAttachment(att.DownloadToken!);
      const mimeType = att.ContentType || contentType || "application/octet-stream";
      const stored = await uploadNoteAttachment({
        workspaceId: params.workspaceId,
        noteId: params.noteId,
        fileName: att.Name,
        mimeType,
        buffer,
        source: "email",
        createdBy: params.createdBy,
        contentId: att.ContentID ?? null,
      });
      storedCount += 1;

      if (isPdfMimeType(mimeType, att.Name)) {
        try {
          const extractedText = await extractPdfText(buffer);
          if (extractedText) {
            await saveAttachmentExtractedText(stored.id, extractedText);
          }
        } catch (err) {
          console.error("[brevo-inbound] PDF text extraction failed", att.Name, err);
        }
      }

      const fileUrl = buildNoteAttachmentFileUrl(params.noteId, stored.id);

      const cid = normalizeCid(att.ContentID);
      if (cid) {
        cidToUrl[cid] = fileUrl;
        const bare = att.ContentID?.replace(/^<|>$/g, "").trim();
        if (bare) cidToUrl[bare] = fileUrl;
      }
    } catch (err) {
      console.error("[brevo-inbound] attachment failed", att.Name, err);
    }
  }

  if (storedCount > 0) {
    try {
      await refreshNoteSearchDocument(params.noteId);
    } catch (err) {
      console.error("[brevo-inbound] search document refresh failed", params.noteId, err);
    }
  }

  return { cidToUrl, storedCount };
}

export async function processInboundEmail(
  payload: BrevoInboundWebhookPayload,
): Promise<ProcessInboundEmailResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "supabase_admin_not_configured" };
  }

  const item = firstInboundItem(payload);
  if (!item) {
    return { ok: false, reason: "empty_payload" };
  }

  const messageId = resolveMessageId(item);
  const inboundDomain = getBrevoInboundDomain();
  const localPart = parseInboundRecipientLocalPart(item, inboundDomain);
  if (!localPart) {
    return { ok: true, status: "ignored", reason: "no_inbound_recipient" };
  }

  if (localPart.startsWith("t-")) {
    const taskResult = await processInboundTaskEmail(payload, localPart);
    if (!taskResult.ok) return taskResult;
    if (taskResult.status === "ignored") return taskResult;
    if (taskResult.status === "duplicate") {
      return {
        ok: true,
        status: "duplicate",
        taskId: taskResult.taskId,
        messageId: taskResult.messageId,
        kind: "task",
      };
    }
    return {
      ok: true,
      status: "created",
      taskId: taskResult.taskId,
      inboxId: taskResult.inboxId,
      localPart: taskResult.localPart,
      kind: "task",
    };
  }

  const supabase = createAdminSupabaseClient();

  if (messageId) {
    const { data: existing } = await supabase
      .from("inbound_email_events")
      .select("note_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        status: "duplicate",
        noteId: (existing as { note_id: string | null }).note_id,
        taskId: (existing as { task_id?: string | null }).task_id ?? null,
        messageId,
        kind: (existing as { task_id?: string | null }).task_id ? "task" : "note",
      };
    }
  }

  const { data: inbox, error: inboxError } = await supabase
    .from("note_email_inboxes")
    .select("id, workspace_id, parent_note_id, local_part, created_by, is_active")
    .eq("local_part", localPart)
    .maybeSingle();

  if (inboxError) {
    if (inboxError.code === "42P01") {
      return { ok: false, reason: "note_email_inboxes_table_missing" };
    }
    console.error("[brevo-inbound] inbox lookup failed", inboxError);
    return { ok: false, reason: "inbox_lookup_failed" };
  }

  const inboxRow = inbox as NoteEmailInboxRow | null;
  if (!inboxRow || !inboxRow.is_active) {
    return { ok: true, status: "ignored", reason: "inbox_not_found" };
  }

  const title = buildInboundNoteTitle(item);
  const rawHtml = item.RawHtmlBody?.trim() ?? "";

  // Insert with full email content immediately (unresolved CIDs are OK); re-finalize after attachments.
  const insertPayload: Record<string, unknown> = {
    workspace_id: inboxRow.workspace_id,
    title,
    content: safeBuildInboundNoteContentJson(item),
    tags: ["from-email"],
    is_archived: false,
    linked_task_ids: [],
    linked_note_ids: [],
    snapshots: [],
    review_status: "pending_review",
    record_type: "email",
  };

  if (inboxRow.created_by) {
    insertPayload.created_by = inboxRow.created_by;
    insertPayload.last_edited_by = inboxRow.created_by;
  }

  if (rawHtml) {
    insertPayload.raw_html = rawHtml;
  }

  let createdNote: { id: string } | null = null;
  let createError: { code?: string; message?: string } | null = null;

  ({ data: createdNote, error: createError } = await (supabase.from("notes") as any)
    .insert(insertPayload)
    .select("id")
    .single());

  if (createError?.code === "42703") {
    const fallback = { ...insertPayload };
    delete fallback.raw_html;
    delete fallback.review_status;
    delete fallback.record_type;
    ({ data: createdNote, error: createError } = await (supabase.from("notes") as any)
      .insert(fallback)
      .select("id")
      .single());
  }

  if (createError || !createdNote) {
    console.error("[brevo-inbound] note create failed", createError);
    return { ok: false, reason: "note_create_failed" };
  }

  const noteId = (createdNote as { id: string }).id;

  let cidToUrl: Record<string, string> = {};
  try {
    const attachmentResult = await processAttachments({
      item,
      noteId,
      workspaceId: inboxRow.workspace_id,
      createdBy: inboxRow.created_by,
    });
    cidToUrl = attachmentResult.cidToUrl;
    if (attachmentResult.storedCount === 0 && (item.Attachments?.length ?? 0) > 0) {
      console.error("[brevo-inbound] email had attachments but none were stored", {
        noteId,
        messageId,
        attachmentNames: (item.Attachments ?? []).map((att: BrevoInboundAttachment) => att.Name),
      });
    }
  } catch (err) {
    console.error("[brevo-inbound] attachment batch failed", err);
  }

  const emailSource: string | null = messageId ? `brevo:${messageId}` : null;

  await finalizeInboundNoteContent({
    supabase,
    noteId,
    item,
    title,
    rawHtml,
    cidToUrl,
    emailSource,
  });

  // EML archive is best-effort and must not block note content finalization.
  if (item.EMLDownloadToken && messageId) {
    void (async () => {
      try {
        const { buffer } = await downloadBrevoInboundEml(item.EMLDownloadToken!);
        const path = await storeInboundEml({
          workspaceId: inboxRow.workspace_id,
          noteId,
          messageId,
          buffer,
        });
        await (supabase.from("notes") as any)
          .update({ email_source: path, updated_at: new Date().toISOString() })
          .eq("id", noteId);
      } catch (err) {
        console.error("[brevo-inbound] EML archive failed", err);
      }
    })();
  }

  if (messageId) {
    try {
      await recordInboundEvent({
        messageId,
        inboxId: inboxRow.id,
        noteId,
        localPart,
      });
    } catch (err) {
      console.error("[brevo-inbound] idempotency record failed", err);
    }
  }

  try {
    await fanoutNoteAddedNotifications({
      workspaceId: inboxRow.workspace_id,
      noteId,
      noteTitle: title,
      actorUserId: inboxRow.created_by,
      source: "email",
      supabase: supabase as any,
    });
  } catch (err) {
    console.error("[brevo-inbound] note-added notification fanout failed", err);
  }

  return {
    ok: true,
    status: "created",
    noteId,
    inboxId: inboxRow.id,
    localPart,
    kind: "note",
  };
}