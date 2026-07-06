import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getListSharePreview, isValidListShareId } from "@/lib/list-share/getListSharePreview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ shareId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { shareId } = await context.params;

  if (!isValidListShareId(shareId)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "List share is not configured on the server." }, { status: 503 });
  }

  const preview = await getListSharePreview(shareId);
  if (!preview) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (!preview.isValid) {
    return NextResponse.json({ error: preview.invalidReason || "Share is no longer valid" }, { status: 409 });
  }

  const admin = createAdminSupabaseClient();
  const { data: invite } = await admin
    .from("list_share_invites")
    .select("invited_user_id, recipient_email")
    .eq("id", shareId)
    .maybeSingle();

  const invitedUserId = (invite as { invited_user_id?: string } | null)?.invited_user_id;
  if (invitedUserId && invitedUserId !== user.id) {
    return NextResponse.json(
      { error: "This share was sent to a different Badazz Tasks account." },
      { status: 403 },
    );
  }

  const recipientEmail = (invite as { recipient_email?: string | null } | null)?.recipient_email;
  if (
    recipientEmail &&
    user.email &&
    recipientEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "This share was sent to a different email address." },
      { status: 403 },
    );
  }

  type RpcClient = {
    rpc: (
      name: string,
      args: { p_invite_id: string },
    ) => Promise<{
      data: Array<{
        workspace_id: string;
        workspace_name: string;
        already_linked: boolean;
      }> | null;
      error: { message?: string } | null;
    }>;
  };

  const { data, error } = await (supabase as unknown as RpcClient).rpc(
    "get_list_share_linked_workspaces",
    { p_invite_id: shareId },
  );

  if (error) {
    return NextResponse.json({ error: error.message || "Could not load workspaces" }, { status: 400 });
  }

  const workspaces = (data ?? []).map((row) => ({
    id: row.workspace_id,
    name: row.workspace_name,
    alreadyLinked: row.already_linked,
  }));

  return NextResponse.json({ workspaces });
}
