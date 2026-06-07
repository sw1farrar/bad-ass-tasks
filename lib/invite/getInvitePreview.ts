import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type InvitePreview = {
  id: string;
  email: string | null;
  role: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: string | null;
  isValid: boolean;
  invalidReason?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidInviteId(value: string): boolean {
  return UUID_RE.test(value);
}

function formatInviterName(profile: { full_name?: string | null; username?: string | null } | null): string {
  if (!profile) return "A teammate";
  if (profile.username) return `@${profile.username}`;
  if (profile.full_name) return profile.full_name;
  return "A teammate";
}

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export async function getInvitePreview(inviteId: string): Promise<InvitePreview | null> {
  if (!isSupabaseAdminConfigured() || !isValidInviteId(inviteId)) {
    return null;
  }

  const admin = createAdminSupabaseClient();

  const { data: invite, error } = await admin
    .from("workspace_invites")
    .select("id, email, role, workspace_id, invited_by, accepted_at, expires_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (error || !invite) {
    return null;
  }

  const row = invite as {
    id: string;
    email: string | null;
    role: string;
    workspace_id: string;
    invited_by: string | null;
    accepted_at: string | null;
    expires_at: string | null;
  };

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", row.workspace_id)
    .maybeSingle();

  let inviterName = "A teammate";
  if (row.invited_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", row.invited_by)
      .maybeSingle();
    inviterName = formatInviterName(profile as { full_name?: string | null; username?: string | null } | null);
  }

  let isValid = true;
  let invalidReason: string | undefined;

  if (row.accepted_at) {
    isValid = false;
    invalidReason = "This invitation has already been accepted.";
  } else if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    isValid = false;
    invalidReason = "This invitation has expired.";
  }

  return {
    id: row.id,
    email: row.email,
    role: roleLabel(row.role),
    workspaceId: row.workspace_id,
    workspaceName: (workspace as { name?: string } | null)?.name || "a workspace",
    inviterName,
    expiresAt: row.expires_at,
    isValid,
    invalidReason,
  };
}