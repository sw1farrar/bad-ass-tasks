import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type ListSharePreview = {
  id: string;
  listId: string;
  listTitle: string;
  openItemCount: number;
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  sharerName: string;
  recipientEmail: string | null;
  expiresAt: string | null;
  isValid: boolean;
  invalidReason?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidListShareId(value: string): boolean {
  return UUID_RE.test(value);
}

function formatSharerName(profile: { full_name?: string | null; username?: string | null } | null): string {
  if (!profile) return "A teammate";
  if (profile.username) return `@${profile.username}`;
  if (profile.full_name) return profile.full_name;
  return "A teammate";
}

export async function getListSharePreview(shareId: string): Promise<ListSharePreview | null> {
  if (!isSupabaseAdminConfigured() || !isValidListShareId(shareId)) {
    return null;
  }

  const admin = createAdminSupabaseClient();

  const { data: invite, error } = await admin
    .from("list_share_invites")
    .select("id, list_id, source_workspace_id, invited_by, recipient_email, expires_at, declined_at, revoked_at")
    .eq("id", shareId)
    .maybeSingle();

  if (error || !invite) {
    return null;
  }

  const row = invite as {
    id: string;
    list_id: string;
    source_workspace_id: string;
    invited_by: string | null;
    recipient_email: string | null;
    expires_at: string | null;
    declined_at: string | null;
    revoked_at: string | null;
  };

  const { data: list } = await admin
    .from("workspace_lists")
    .select("title")
    .eq("id", row.list_id)
    .maybeSingle();

  const { count: openCount } = await admin
    .from("list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", row.list_id)
    .eq("completed", false)
    .eq("pending", false);

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", row.source_workspace_id)
    .maybeSingle();

  let sharerName = "A teammate";
  if (row.invited_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", row.invited_by)
      .maybeSingle();
    sharerName = formatSharerName(profile as { full_name?: string | null; username?: string | null } | null);
  }

  let isValid = true;
  let invalidReason: string | undefined;

  if (row.declined_at) {
    isValid = false;
    invalidReason = "This share invitation was declined.";
  } else if (row.revoked_at) {
    isValid = false;
    invalidReason = "This share invitation is no longer active.";
  } else if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    isValid = false;
    invalidReason = "This share invitation has expired.";
  }

  return {
    id: row.id,
    listId: row.list_id,
    listTitle: (list as { title?: string } | null)?.title || "Shared list",
    openItemCount: openCount ?? 0,
    sourceWorkspaceId: row.source_workspace_id,
    sourceWorkspaceName: (workspace as { name?: string } | null)?.name || "a workspace",
    sharerName,
    recipientEmail: row.recipient_email,
    expiresAt: row.expires_at,
    isValid,
    invalidReason,
  };
}