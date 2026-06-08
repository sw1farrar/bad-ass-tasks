import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateNoteInboxLocalPart } from "./generateInboxLocalPart";
import { formatInboxEmailAddress } from "./buildInboxAddress";

export type NoteEmailInboxDto = {
  id: string;
  workspaceId: string;
  /** @deprecated Legacy per-note inboxes; new workspaces use workspace-level Review intake only. */
  parentNoteId: string | null;
  parentNoteTitle: string | null;
  label: string | null;
  localPart: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

async function assertWorkspaceMember(workspaceId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("membership_check_failed");
  if (!data) throw new Error("not_a_member");
}

function mapInboxRow(
  row: {
    id: string;
    workspace_id: string;
    parent_note_id: string | null;
    label: string | null;
    local_part: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  },
  parentTitle: string | null = null,
): NoteEmailInboxDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentNoteId: row.parent_note_id,
    parentNoteTitle: parentTitle,
    label: row.label,
    localPart: row.local_part,
    emailAddress: formatInboxEmailAddress(row.local_part),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspaceNoteInboxes(
  workspaceId: string,
  userId: string,
): Promise<NoteEmailInboxDto[]> {
  await assertWorkspaceMember(workspaceId, userId);

  const supabase = await createServerSupabaseClient();
  const { data: inboxes, error } = await (supabase.from("note_email_inboxes") as any)
    .select("id, workspace_id, parent_note_id, label, local_part, is_active, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error("inbox_list_failed");

  const inboxRows = (inboxes ?? []) as Array<{
    id: string;
    workspace_id: string;
    parent_note_id: string | null;
    label: string | null;
    local_part: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;

  return inboxRows.map((row) => mapInboxRow(row));
}

export async function getWorkspaceNoteInbox(
  workspaceId: string,
  userId: string,
): Promise<NoteEmailInboxDto | null> {
  const inboxes = await listWorkspaceNoteInboxes(workspaceId, userId);
  return inboxes[0] ?? null;
}

export async function createWorkspaceNoteInbox(params: {
  workspaceId: string;
  userId: string;
}): Promise<NoteEmailInboxDto> {
  if (["w1", "w2"].includes(params.workspaceId)) {
    throw new Error("demo_workspace");
  }

  await assertWorkspaceMember(params.workspaceId, params.userId);

  const existing = await getWorkspaceNoteInbox(params.workspaceId, params.userId);
  if (existing) {
    throw new Error("inbox_already_exists");
  }

  const supabase = await createServerSupabaseClient();
  const localPart = generateNoteInboxLocalPart(params.workspaceId);
  const label = `Files Review · ${localPart.slice(-8)}`;

  const { data, error } = await (supabase.from("note_email_inboxes") as any)
    .insert({
      workspace_id: params.workspaceId,
      parent_note_id: null,
      local_part: localPart,
      label,
      created_by: params.userId,
      is_active: true,
    })
    .select("id, workspace_id, parent_note_id, label, local_part, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("inbox_already_exists");
    }
    throw new Error("inbox_create_failed");
  }
  if (!data) throw new Error("inbox_create_failed");

  return mapInboxRow(data);
}

export async function updateWorkspaceNoteInbox(params: {
  inboxId: string;
  workspaceId: string;
  userId: string;
  isActive?: boolean;
  label?: string;
}): Promise<NoteEmailInboxDto> {
  await assertWorkspaceMember(params.workspaceId, params.userId);

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = {};
  if (params.isActive !== undefined) updates.is_active = params.isActive;
  if (params.label !== undefined) updates.label = params.label?.trim() || null;

  const { data, error } = await (supabase.from("note_email_inboxes") as any)
    .update(updates)
    .eq("id", params.inboxId)
    .eq("workspace_id", params.workspaceId)
    .select("id, workspace_id, parent_note_id, label, local_part, is_active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error("inbox_update_failed");

  return mapInboxRow(data);
}

export async function deleteWorkspaceNoteInbox(params: {
  inboxId: string;
  workspaceId: string;
  userId: string;
}): Promise<void> {
  await assertWorkspaceMember(params.workspaceId, params.userId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("note_email_inboxes")
    .delete()
    .eq("id", params.inboxId)
    .eq("workspace_id", params.workspaceId);

  if (error) throw new Error("inbox_delete_failed");
}

/** Admin lookup for inbound processing (bypasses RLS). */
export async function getActiveInboxByLocalPart(localPart: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("note_email_inboxes")
    .select("id, workspace_id, parent_note_id, local_part, created_by, is_active, label")
    .eq("local_part", localPart)
    .maybeSingle();

  if (error) return { inbox: null, error };
  return { inbox: data, error: null };
}