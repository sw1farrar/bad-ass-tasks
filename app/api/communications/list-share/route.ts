import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isBrevoConfigured, sendListShareEmail } from "@/lib/brevo";

type ListShareEmailBody = {
  sourceWorkspaceId?: string;
  shareId?: string;
  email?: string;
  listTitle?: string;
  sourceWorkspaceName?: string;
  sharerName?: string;
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

  let body: ListShareEmailBody;
  try {
    body = (await request.json()) as ListShareEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceWorkspaceId = body.sourceWorkspaceId?.trim();
  const shareId = body.shareId?.trim();
  const email = body.email?.trim().toLowerCase();
  const listTitle = body.listTitle?.trim() || "a list";
  const sourceWorkspaceName = body.sourceWorkspaceName?.trim() || "a workspace";
  const sharerName = body.sharerName?.trim() || user.email || "A teammate";

  if (!sourceWorkspaceId || !shareId || !email || !email.includes("@")) {
    return NextResponse.json(
      { error: "sourceWorkspaceId, shareId, and valid email are required" },
      { status: 400 },
    );
  }

  if (["w1", "w2"].includes(sourceWorkspaceId)) {
    return NextResponse.json({ error: "Demo workspaces cannot send email" }, { status: 400 });
  }

  const { data: membership, error: memberError } = await (supabase.from("workspace_members") as ReturnType<typeof supabase.from>)
    .select("role")
    .eq("workspace_id", sourceWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const memberRole = (membership as { role?: string } | null)?.role;
  if (memberError || !memberRole || !["owner", "admin"].includes(memberRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invite, error: inviteError } = await (supabase.from("list_share_invites") as ReturnType<typeof supabase.from>)
    .select("id, source_workspace_id, recipient_email, revoked_at, declined_at")
    .eq("id", shareId)
    .eq("source_workspace_id", sourceWorkspaceId)
    .maybeSingle();

  const inviteRow = invite as {
    id: string;
    source_workspace_id: string;
    recipient_email: string | null;
    revoked_at: string | null;
    declined_at: string | null;
  } | null;

  if (inviteError || !inviteRow) {
    return NextResponse.json({ error: "Share invite not found" }, { status: 404 });
  }

  if (inviteRow.revoked_at || inviteRow.declined_at) {
    return NextResponse.json({ error: "Share invite is no longer active" }, { status: 409 });
  }

  if (inviteRow.recipient_email && inviteRow.recipient_email.toLowerCase() !== email) {
    return NextResponse.json({ error: "Email does not match share invite" }, { status: 400 });
  }

  const result = await sendListShareEmail({
    to: email,
    sharerName,
    listTitle,
    sourceWorkspaceName,
    shareId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send share email", reason: result.reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}