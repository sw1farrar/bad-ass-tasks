import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isBrevoConfigured, sendWorkspaceInviteEmail } from "@/lib/brevo";

type InviteEmailBody = {
  workspaceId?: string;
  inviteId?: string;
  email?: string;
  workspaceName?: string;
  role?: string;
  inviterName?: string;
};

export async function POST(request: Request) {
  if (!isBrevoConfigured()) {
    return NextResponse.json(
      { error: "Brevo is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in .env.local." },
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

  let body: InviteEmailBody;
  try {
    body = (await request.json()) as InviteEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  const inviteId = body.inviteId?.trim();
  const email = body.email?.trim().toLowerCase();
  const workspaceName = body.workspaceName?.trim() || "your workspace";
  const inviterName = body.inviterName?.trim() || user.email || "A teammate";

  if (!workspaceId || !inviteId || !email || !email.includes("@")) {
    return NextResponse.json({ error: "workspaceId, inviteId, and valid email are required" }, { status: 400 });
  }

  if (["w1", "w2"].includes(workspaceId)) {
    return NextResponse.json({ error: "Demo workspaces cannot send email" }, { status: 400 });
  }

  const { data: membership, error: memberError } = await (supabase.from("workspace_members") as ReturnType<typeof supabase.from>)
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const memberRole = (membership as { role?: string } | null)?.role;
  if (memberError || !memberRole || !["owner", "admin"].includes(memberRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invite, error: inviteError } = await (supabase.from("workspace_invites") as ReturnType<typeof supabase.from>)
    .select("id, workspace_id, email, role, accepted_at, expires_at")
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const inviteRow = invite as {
    id: string;
    workspace_id: string;
    email: string | null;
    role: string | null;
    accepted_at: string | null;
    expires_at: string | null;
  } | null;

  if (inviteError || !inviteRow) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (inviteRow.accepted_at) {
    return NextResponse.json({ error: "Invite is no longer active" }, { status: 409 });
  }

  if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 409 });
  }

  if (inviteRow.email && inviteRow.email.toLowerCase() !== email) {
    return NextResponse.json({ error: "Email does not match invite" }, { status: 400 });
  }

  const inviteDbRole = inviteRow.role?.trim().toLowerCase();
  const role =
    inviteDbRole === "owner" || inviteDbRole === "admin" || inviteDbRole === "user"
      ? inviteDbRole === "user"
        ? "member"
        : inviteDbRole
      : "member";

  const result = await sendWorkspaceInviteEmail({
    to: email,
    inviterName,
    workspaceName,
    inviteId,
    role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send invite email", reason: result.reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}