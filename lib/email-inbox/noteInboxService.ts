import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateInboxLocalPart } from "./generateInboxLocalPart";
import { formatInboxEmailAddress } from "./buildInboxAddress";
import { getNoteDepth, isEligibleEmailInboxParent } from "@/lib/notes/noteDepth";

export type NoteEmailInboxDto = {
  id: string;
  workspaceId: string;
  parentNoteId: string | null;
  parentNoteTitle: string | null;
  label: string | null;
  localPart: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type NoteRow = { id: string; title: string; workspace_id: string; parent_note_id: string | null };

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

async function fetchNotesForDepthCheck(workspaceId: string): Promise<NoteRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, workspace_id, parent_note_id")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false);

  if (error) throw new Error("notes_fetch_failed");
  return (data ?? []) as NoteRow[];
}

export async function validateParentNoteForInbox(
  workspaceId: string,
  parentNoteId: string,
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const notes = await fetchNotesForDepthCheck(workspaceId);
  const parent = notes.find((n) => n.id === parentNoteId);
  if (!parent) return { ok: false, error: "parent_note_not_found" };
  if (parent.workspace_id !== workspaceId) return { ok: false, error: "parent_workspace_mismatch" };

  const depth = getNoteDepth(
    parentNoteId,
    notes.map((n) => ({ id: n.id, parentNoteId: n.parent_note_id })),
  );

  if (!isEligibleEmailInboxParent(depth)) {
    return { ok: false, error: "parent_depth_not_allowed" };
  }

  return { ok: true, title: parent.title?.trim() || "Untitled note" };
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
  parentTitle: string | null,
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
    .order("created_at", { ascending: false });

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

  const parentIds = [...new Set(inboxRows.map((i) => i.parent_note_id).filter(Boolean))] as string[];
  const parentTitleById = new Map<string, string>();

  if (parentIds.length) {
    const { data: parents } = await (supabase.from("notes") as any)
      .select("id, title")
      .in("id", parentIds);
    ((parents ?? []) as Array<{ id: string; title: string | null }>).forEach((p) => {
      parentTitleById.set(p.id, p.title?.trim() || "Untitled note");
    });
  }

  return inboxRows.map((row) =>
    mapInboxRow(row, row.parent_note_id ? parentTitleById.get(row.parent_note_id) ?? null : null),
  );
}

export async function createWorkspaceNoteInbox(params: {
  workspaceId: string;
  parentNoteId: string;
  userId: string;
}): Promise<NoteEmailInboxDto> {
  if (["w1", "w2"].includes(params.workspaceId)) {
    throw new Error("demo_workspace");
  }

  await assertWorkspaceMember(params.workspaceId, params.userId);

  const parentCheck = await validateParentNoteForInbox(params.workspaceId, params.parentNoteId);
  if (!parentCheck.ok) throw new Error(parentCheck.error);

  const supabase = await createServerSupabaseClient();
  const localPart = generateInboxLocalPart(params.workspaceId);
  const label = `${parentCheck.title} · ${localPart.slice(-8)}`;

  const { data, error } = await (supabase.from("note_email_inboxes") as any)
    .insert({
      workspace_id: params.workspaceId,
      parent_note_id: params.parentNoteId,
      local_part: localPart,
      label,
      created_by: params.userId,
      is_active: true,
    })
    .select("id, workspace_id, parent_note_id, label, local_part, is_active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error("inbox_create_failed");

  return mapInboxRow(data, parentCheck.title);
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

  let parentTitle: string | null = null;
  if (data.parent_note_id) {
    const { data: parent } = await (supabase.from("notes") as any)
      .select("title")
      .eq("id", data.parent_note_id)
      .maybeSingle();
    parentTitle = (parent as { title?: string } | null)?.title?.trim() || "Untitled note";
  }

  return mapInboxRow(data, parentTitle);
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