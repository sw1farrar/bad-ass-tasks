import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { buildInboundTaskFields } from "./inboundTaskContent";
import type { BrevoInboundEmailItem, BrevoInboundWebhookPayload } from "./inboundTypes";

export type ProcessInboundTaskEmailResult =
  | { ok: true; status: "created"; taskId: string; inboxId: string; localPart: string }
  | { ok: true; status: "duplicate"; taskId: string | null; messageId: string }
  | { ok: true; status: "ignored"; reason: string }
  | { ok: false; reason: string };

type TaskEmailInboxRow = {
  id: string;
  workspace_id: string;
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

async function recordInboundEvent(params: {
  messageId: string;
  taskInboxId: string;
  taskId: string | null;
  localPart: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await (supabase.from("inbound_email_events") as any).insert({
    message_id: params.messageId,
    task_inbox_id: params.taskInboxId,
    task_id: params.taskId,
    local_part: params.localPart,
  });
}

export async function processInboundTaskEmail(
  payload: BrevoInboundWebhookPayload,
  localPart: string,
): Promise<ProcessInboundTaskEmailResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "supabase_admin_not_configured" };
  }

  const item = firstInboundItem(payload);
  if (!item) {
    return { ok: false, reason: "empty_payload" };
  }

  const messageId = resolveMessageId(item);
  const supabase = createAdminSupabaseClient();

  if (messageId) {
    const { data: existing } = await supabase
      .from("inbound_email_events")
      .select("task_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        status: "duplicate",
        taskId: (existing as { task_id: string | null }).task_id,
        messageId,
      };
    }
  }

  const { data: inbox, error: inboxError } = await supabase
    .from("task_email_inboxes")
    .select("id, workspace_id, local_part, created_by, is_active")
    .eq("local_part", localPart)
    .maybeSingle();

  if (inboxError) {
    if (inboxError.code === "42P01") {
      return { ok: false, reason: "task_email_inboxes_table_missing" };
    }
    console.error("[brevo-inbound] task inbox lookup failed", inboxError);
    return { ok: false, reason: "inbox_lookup_failed" };
  }

  const inboxRow = inbox as TaskEmailInboxRow | null;
  if (!inboxRow || !inboxRow.is_active) {
    return { ok: true, status: "ignored", reason: "inbox_not_found" };
  }

  const { title, description, dueDate } = buildInboundTaskFields(item);

  const insertPayload: Record<string, unknown> = {
    workspace_id: inboxRow.workspace_id,
    title,
    description: description || null,
    status: "todo",
    priority: "P2",
    tags: ["from-email"],
    linked_note_ids: [],
    assignee_ids: [],
  };

  if (dueDate) {
    insertPayload.due_date = dueDate;
  }

  if (inboxRow.created_by) {
    insertPayload.created_by = inboxRow.created_by;
  }

  const { data: createdTask, error: createError } = await (supabase.from("tasks") as any)
    .insert(insertPayload)
    .select("id")
    .single();

  if (createError || !createdTask) {
    console.error("[brevo-inbound] task create failed", createError);
    return { ok: false, reason: "task_create_failed" };
  }

  const taskId = (createdTask as { id: string }).id;

  if (messageId) {
    try {
      await recordInboundEvent({
        messageId,
        taskInboxId: inboxRow.id,
        taskId,
        localPart,
      });
    } catch (err) {
      console.error("[brevo-inbound] task idempotency record failed", err);
    }
  }

  return {
    ok: true,
    status: "created",
    taskId,
    inboxId: inboxRow.id,
    localPart,
  };
}