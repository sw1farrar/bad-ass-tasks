import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateTaskInboxLocalPart } from "./generateInboxLocalPart";
import { formatInboxEmailAddress } from "./buildInboxAddress";

export type TaskEmailInboxDto = {
  id: string;
  workspaceId: string;
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

function mapInboxRow(row: {
  id: string;
  workspace_id: string;
  label: string | null;
  local_part: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): TaskEmailInboxDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    label: row.label,
    localPart: row.local_part,
    emailAddress: formatInboxEmailAddress(row.local_part),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspaceTaskInboxes(
  workspaceId: string,
  userId: string,
): Promise<TaskEmailInboxDto[]> {
  await assertWorkspaceMember(workspaceId, userId);

  const supabase = await createServerSupabaseClient();
  const { data: inboxes, error } = await (supabase.from("task_email_inboxes") as any)
    .select("id, workspace_id, label, local_part, is_active, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("inbox_list_failed");
  return ((inboxes ?? []) as Array<Parameters<typeof mapInboxRow>[0]>).map(mapInboxRow);
}

export async function getWorkspaceTaskInbox(
  workspaceId: string,
  userId: string,
): Promise<TaskEmailInboxDto | null> {
  const inboxes = await listWorkspaceTaskInboxes(workspaceId, userId);
  return inboxes[0] ?? null;
}

export async function createWorkspaceTaskInbox(params: {
  workspaceId: string;
  userId: string;
}): Promise<TaskEmailInboxDto> {
  if (["w1", "w2"].includes(params.workspaceId)) {
    throw new Error("demo_workspace");
  }

  await assertWorkspaceMember(params.workspaceId, params.userId);

  const existing = await getWorkspaceTaskInbox(params.workspaceId, params.userId);
  if (existing) {
    throw new Error("inbox_already_exists");
  }

  const supabase = await createServerSupabaseClient();
  const localPart = generateTaskInboxLocalPart(params.workspaceId);
  const label = `Tasks · ${localPart.slice(-8)}`;

  const { data, error } = await (supabase.from("task_email_inboxes") as any)
    .insert({
      workspace_id: params.workspaceId,
      local_part: localPart,
      label,
      created_by: params.userId,
      is_active: true,
    })
    .select("id, workspace_id, label, local_part, is_active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error("inbox_create_failed");
  return mapInboxRow(data);
}

export async function updateWorkspaceTaskInbox(params: {
  inboxId: string;
  workspaceId: string;
  userId: string;
  isActive?: boolean;
  label?: string;
}): Promise<TaskEmailInboxDto> {
  await assertWorkspaceMember(params.workspaceId, params.userId);

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = {};
  if (params.isActive !== undefined) updates.is_active = params.isActive;
  if (params.label !== undefined) updates.label = params.label?.trim() || null;

  const { data, error } = await (supabase.from("task_email_inboxes") as any)
    .update(updates)
    .eq("id", params.inboxId)
    .eq("workspace_id", params.workspaceId)
    .select("id, workspace_id, label, local_part, is_active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error("inbox_update_failed");
  return mapInboxRow(data);
}

export async function deleteWorkspaceTaskInbox(params: {
  inboxId: string;
  workspaceId: string;
  userId: string;
}): Promise<void> {
  await assertWorkspaceMember(params.workspaceId, params.userId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("task_email_inboxes")
    .delete()
    .eq("id", params.inboxId)
    .eq("workspace_id", params.workspaceId);

  if (error) throw new Error("inbox_delete_failed");
}

/** Admin lookup for inbound processing (bypasses RLS). */
export async function getActiveTaskInboxByLocalPart(localPart: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("task_email_inboxes")
    .select("id, workspace_id, local_part, created_by, is_active, label")
    .eq("local_part", localPart)
    .maybeSingle();

  if (error) return { inbox: null, error };
  return { inbox: data, error: null };
}