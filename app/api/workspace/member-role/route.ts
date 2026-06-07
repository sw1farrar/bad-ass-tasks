import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { fromDbRole, type WorkspaceRole } from "@/lib/roles";
import { executeUpdateMemberRole } from "@/lib/workspace/transferOwnership";

type MemberRoleBody = {
  workspaceId?: string;
  userId?: string;
  newRole?: WorkspaceRole;
};

const VALID_ROLES: WorkspaceRole[] = ["owner", "admin", "member"];

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Member role updates are not configured on the server (missing SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: MemberRoleBody;
  try {
    body = (await request.json()) as MemberRoleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  const targetUserId = body.userId?.trim();
  const newRole = body.newRole;

  if (!workspaceId || !targetUserId || !newRole || !VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "workspaceId, userId, and valid newRole are required" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot change your own role here" }, { status: 400 });
  }

  const { data: callerMembership, error: callerErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (callerErr) {
    return NextResponse.json({ error: callerErr.message || "Could not verify membership" }, { status: 500 });
  }

  const callerRole = fromDbRole((callerMembership as { role?: string } | null)?.role);
  if (!["owner", "admin"].includes(callerRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const result = await executeUpdateMemberRole({
    workspaceId,
    targetUserId,
    newRole,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}