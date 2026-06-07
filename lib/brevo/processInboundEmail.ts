import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getBrevoInboundDomain } from "./inboundConfig";
import { buildInboundNoteTitle } from "./inboundNoteContent";
import {
  buildInboundNoteContentJson,
  buildInboundNotePlaceholderContent,
} from "@/lib/notes/emailHtmlToTipTap";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";
import { downloadBrevoInboundEml } from "./downloadInboundEml";
import { storeInboundEml } from "@/lib/storage/inboundEml";
import { parseInboundRecipientLocalPart } from "./parseInboundRecipient";
import { downloadBrevoInboundAttachment } from "./downloadInboundAttachment";
import { uploadNoteAttachment } from "@/lib/storage/noteAttachments";
import { buildNoteAttachmentFileUrl } from "@/lib/notes/attachmentUrls";
import { processInboundTaskEmail } from "./processInboundTaskEmail";
import { fanoutNoteAddedNotifications } from "@/lib/notifications/fanoutNoteAdded";
import type { BrevoInboundEmailItem, BrevoInboundWebhookPayload } from "./inboundTypes";

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
}): Promise<Record<string, string>> {
  const attachments = params.item.Attachments ?? [];
  if (!attachments.length) return {};

  const cidToUrl: Record<string, string> = {};

  for (const att of attachments) {
    if (!att.DownloadToken || !att.Name) continue;

    try {
      const { buffer, contentType } = await downloadBrevoInboundAttachment(att.DownloadToken);
      const stored = await uploadNoteAttachment({
        workspaceId: params.workspaceId,
        noteId: params.noteId,
        fileName: att.Name,
        mimeType: att.ContentType || contentType || "application/octet-stream",
        buffer,
        source: "email",
        createdBy: params.createdBy,
        contentId: att.ContentID ?? null,
      });

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

  return cidToUrl;
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

  if (inboxRow.parent_note_id) {
    const { data: parentNote, error: parentError } = await supabase
      .from("notes")
      .select("id, workspace_id, parent_note_id")
      .eq("id", inboxRow.parent_note_id)
      .maybeSingle();

    if (parentError || !parentNote) {
      return { ok: true, status: "ignored", reason: "parent_note_missing" };
    }

    if ((parentNote as { workspace_id: string }).workspace_id !== inboxRow.workspace_id) {
      return { ok: true, status: "ignored", reason: "parent_workspace_mismatch" };
    }
  }

  const title = buildInboundNoteTitle(item);
  const rawHtml = item.RawHtmlBody?.trim() ?? "";

  // Placeholder note so attachment uploads have a note_id; email block finalized after CID resolution.
  const insertPayload: Record<string, unknown> = {
    workspace_id: inboxRow.workspace_id,
    title,
    content: buildInboundNotePlaceholderContent(item),
    tags: ["from-email"],
    is_archived: false,
    linked_task_ids: [],
    linked_note_ids: [],
    snapshots: [],
  };

  if (inboxRow.parent_note_id) {
    insertPayload.parent_note_id = inboxRow.parent_note_id;
  } else {
    console.warn("[brevo-inbound] inbox has no parent_note_id; note will appear at root", {
      inboxId: inboxRow.id,
      localPart,
    });
  }

  if (inboxRow.created_by) {
    insertPayload.created_by = inboxRow.created_by;
    insertPayload.last_edited_by = inboxRow.created_by;
  }

  const { data: createdNote, error: createError } = await (supabase.from("notes") as any)
    .insert(insertPayload)
    .select("id")
    .single();

  if (createError || !createdNote) {
    console.error("[brevo-inbound] note create failed", createError);
    return { ok: false, reason: "note_create_failed" };
  }

  const noteId = (createdNote as { id: string }).id;

  let cidToUrl: Record<string, string> = {};
  try {
    cidToUrl = await processAttachments({
      item,
      noteId,
      workspaceId: inboxRow.workspace_id,
      createdBy: inboxRow.created_by,
    });
  } catch (err) {
    console.error("[brevo-inbound] attachment batch failed", err);
  }

  const finalContent = buildInboundNoteContentJson(item, cidToUrl);
  const searchPlain = [title, extractNoteSearchText(finalContent)].filter(Boolean).join(" ").trim();

  let emailSource: string | null = messageId ? `brevo:${messageId}` : null;

  if (item.EMLDownloadToken && messageId) {
    try {
      const { buffer } = await downloadBrevoInboundEml(item.EMLDownloadToken);
      emailSource = await storeInboundEml({
        workspaceId: inboxRow.workspace_id,
        noteId,
        messageId,
        buffer,
      });
    } catch (err) {
      console.error("[brevo-inbound] EML archive failed", err);
    }
  }

  const updatePayload: Record<string, unknown> = {
    content: finalContent,
    updated_at: new Date().toISOString(),
    raw_html: rawHtml || null,
    email_source: emailSource,
    search_plain: searchPlain || null,
    email_pipeline_version: EMAIL_PIPELINE_VERSION,
  };

  let { error: contentError } = await (supabase.from("notes") as any)
    .update(updatePayload)
    .eq("id", noteId);

  if (contentError?.code === "42703") {
    ({ error: contentError } = await (supabase.from("notes") as any)
      .update({ content: finalContent, updated_at: updatePayload.updated_at })
      .eq("id", noteId));
  }

  if (contentError) {
    console.error("[brevo-inbound] note content update failed", contentError);
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

  fanoutNoteAddedNotifications({
    workspaceId: inboxRow.workspace_id,
    noteId,
    noteTitle: title,
    actorUserId: inboxRow.created_by,
    source: "email",
    supabase: supabase as any,
  }).catch((err) => {
    console.error("[brevo-inbound] note-added notification fanout failed", err);
  });

  return {
    ok: true,
    status: "created",
    noteId,
    inboxId: inboxRow.id,
    localPart,
    kind: "note",
  };
}