import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { toDbRole, type WorkspaceRole } from "@/lib/roles";

export type TransferOwnershipResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Server-only: transfer workspace ownership using the service role after caller
 * authorization has been verified by the API route.
 */
export async function executeTransferOwnership(params: {
  workspaceId: string;
  currentOwnerId: string;
  newOwnerId: string;
}): Promise<TransferOwnershipResult> {
  const { workspaceId, currentOwnerId, newOwnerId } = params;

  if (!workspaceId || !currentOwnerId || !newOwnerId) {
    return { ok: false, error: "Missing required fields", status: 400 };
  }
  if (currentOwnerId === newOwnerId) {
    return { ok: false, error: "Choose a different member to receive ownership", status: 400 };
  }

  const admin = createAdminSupabaseClient();

  const { data: targetMember, error: targetErr } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", newOwnerId)
    .maybeSingle();

  if (targetErr) {
    return { ok: false, error: targetErr.message || "Could not verify new owner membership", status: 500 };
  }
  if (!targetMember) {
    return { ok: false, error: "Selected member is not in this workspace", status: 404 };
  }

  const { error: promoteErr } = await (admin.from("workspace_members") as ReturnType<typeof admin.from>)
    .update({ role: toDbRole("owner") })
    .eq("workspace_id", workspaceId)
    .eq("user_id", newOwnerId);

  if (promoteErr) {
    return { ok: false, error: promoteErr.message || "Failed to promote new owner", status: 500 };
  }

  const { error: demoteErr } = await (admin.from("workspace_members") as ReturnType<typeof admin.from>)
    .update({ role: toDbRole("admin") })
    .eq("workspace_id", workspaceId)
    .eq("user_id", currentOwnerId);

  if (demoteErr) {
    return { ok: false, error: demoteErr.message || "Failed to update your role after transfer", status: 500 };
  }

  const { error: wsErr } = await (admin.from("workspaces") as ReturnType<typeof admin.from>)
    .update({ owner_id: newOwnerId })
    .eq("id", workspaceId);

  if (wsErr) {
    return { ok: false, error: wsErr.message || "Failed to update workspace owner record", status: 500 };
  }

  return { ok: true };
}

export type UpdateMemberRoleResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/** Server-only member role update (service role) after caller authorization in API route. */
export async function executeUpdateMemberRole(params: {
  workspaceId: string;
  targetUserId: string;
  newRole: WorkspaceRole;
}): Promise<UpdateMemberRoleResult> {
  const { workspaceId, targetUserId, newRole } = params;

  if (newRole === "owner") {
    return {
      ok: false,
      error: "Use transfer ownership to assign the owner role",
      status: 403,
    };
  }

  const admin = createAdminSupabaseClient();

  const { data: target, error: targetErr } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetErr) {
    return { ok: false, error: targetErr.message || "Could not load member", status: 500 };
  }
  if (!target) {
    return { ok: false, error: "Member not found", status: 404 };
  }

  const targetRole = (target as { role?: string }).role;
  if (targetRole === "owner") {
    const { count, error: countErr } = await admin
      .from("workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner");

    if (countErr) {
      return { ok: false, error: countErr.message || "Could not verify owner count", status: 500 };
    }
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Cannot demote the last owner of the workspace", status: 409 };
    }
  }

  const { error } = await (admin.from("workspace_members") as ReturnType<typeof admin.from>)
    .update({ role: toDbRole(newRole) })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (error) {
    return { ok: false, error: error.message || "Failed to update member role", status: 500 };
  }

  return { ok: true };
}