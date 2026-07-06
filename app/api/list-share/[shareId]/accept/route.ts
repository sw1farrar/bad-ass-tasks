import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/invite/ensureUserProfile";
import { getListSharePreview, isValidListShareId } from "@/lib/list-share/getListSharePreview";
import {
  isListShareRecipient,
  listShareRecipientMismatchMessage,
  normalizeListShareEmail,
} from "@/lib/list-share/listShareRecipientAuth";
import { checkUsernameAvailable } from "@/lib/profile/checkUsernameAvailable";
import { sanitizeUsername, validateUsername } from "@/lib/profile/username";
import { isBrevoConfigured, sendListShareAcceptedEmail } from "@/lib/brevo";

type RouteContext = { params: Promise<{ shareId: string }> };

type AcceptBody = {
  targetWorkspaceId?: string;
  email?: string;
  password?: string;
  fullName?: string;
  username?: string;
  location?: string;
};



async function acceptShareForUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  shareId: string,
  targetWorkspaceId: string,
) {
  type RpcClient = {
    rpc: (
      name: string,
      args: { p_invite_id: string; p_target_workspace_id: string },
    ) => Promise<{
      data: Array<{ list_id: string; target_workspace_id: string }> | null;
      error: { message?: string } | null;
    }>;
  };

  const { data, error } = await (supabase as unknown as RpcClient).rpc("accept_list_share_invite", {
    p_invite_id: shareId,
    p_target_workspace_id: targetWorkspaceId,
  });

  if (error) {
    throw new Error(error.message || "Could not accept shared list.");
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("Could not accept shared list.");
  }

  return { listId: row.list_id, targetWorkspaceId: row.target_workspace_id };
}

async function sendAcceptanceEmail(
  shareId: string,
  targetWorkspaceId: string,
  listId: string,
  recipientEmail: string,
) {
  if (!isBrevoConfigured()) return;

  const preview = await getListSharePreview(shareId);
  if (!preview) return;

  const admin = createAdminSupabaseClient();
  const { data: targetWs } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", targetWorkspaceId)
    .maybeSingle();

  await sendListShareAcceptedEmail({
    to: recipientEmail,
    sharerName: preview.sharerName,
    listTitle: preview.listTitle,
    sourceWorkspaceName: preview.sourceWorkspaceName,
    targetWorkspaceName: (targetWs as { name?: string } | null)?.name || "your workspace",
    listId,
    targetWorkspaceId,
  });
}

export async function POST(request: Request, context: RouteContext) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "List share acceptance is not configured on the server." },
      { status: 503 },
    );
  }

  const { shareId } = await context.params;
  if (!isValidListShareId(shareId)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  const preview = await getListSharePreview(shareId);
  if (!preview) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (!preview.isValid) {
    return NextResponse.json({ error: preview.invalidReason || "Share is no longer valid" }, { status: 409 });
  }

  let body: AcceptBody;
  try {
    body = (await request.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetWorkspaceId = body.targetWorkspaceId?.trim();
  if (!targetWorkspaceId) {
    return NextResponse.json({ error: "targetWorkspaceId is required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (sessionUser) {
    const admin = createAdminSupabaseClient();
    const { data: invite } = await admin
      .from("list_share_invites")
      .select("invited_user_id, recipient_email")
      .eq("id", shareId)
      .maybeSingle();

    const inviteRow = invite as {
      invited_user_id?: string | null;
      recipient_email?: string | null;
    } | null;

    if (
      !isListShareRecipient(
        {
          invitedUserId: inviteRow?.invited_user_id,
          recipientEmail: inviteRow?.recipient_email ?? preview.recipientEmail,
        },
        { id: sessionUser.id, email: sessionUser.email },
      )
    ) {
      return NextResponse.json(
        {
          error: listShareRecipientMismatchMessage({
            invitedUserId: inviteRow?.invited_user_id,
            recipientEmail: inviteRow?.recipient_email ?? preview.recipientEmail,
          }),
        },
        { status: 403 },
      );
    }

    try {
      await ensureUserProfile(sessionUser.id, sessionUser.email);
      const result = await acceptShareForUser(supabase, shareId, targetWorkspaceId);
      if (sessionUser.email) {
        await sendAcceptanceEmail(shareId, result.targetWorkspaceId, result.listId, sessionUser.email);
      }
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not accept shared list.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const password = body.password?.trim() ?? "";
  const fullName = body.fullName?.trim() ?? "";
  const username = sanitizeUsername(body.username ?? "");
  const location = body.location?.trim() ?? "";
  const requestedEmail = body.email ? normalizeListShareEmail(body.email) ?? "" : "";
  const inviteEmail = preview.recipientEmail ? normalizeListShareEmail(preview.recipientEmail) ?? "" : "";
  const email = inviteEmail || requestedEmail;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (inviteEmail && requestedEmail && inviteEmail !== requestedEmail) {
    return NextResponse.json({ error: "This share was sent to a different email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  }

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.ok) {
    return NextResponse.json({ error: usernameValidation.error }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "Where you're from is required." }, { status: 400 });
  }

  const usernameCheck = await checkUsernameAvailable(username);
  if (!usernameCheck.available) {
    return NextResponse.json(
      { error: usernameCheck.error || "That username is already taken." },
      { status: 409 },
    );
  }

  const admin = createAdminSupabaseClient();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError && !/already|registered|exists/i.test(createError.message)) {
    return NextResponse.json({ error: createError.message || "Could not create account." }, { status: 400 });
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.user) {
    const message = createError
      ? "An account already exists for this email. Enter the correct password to accept."
      : signInError?.message || "Could not sign you in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    await ensureUserProfile(signInData.user.id, signInData.user.email, {
      fullName,
      username,
      location,
    });
    const result = await acceptShareForUser(supabase, shareId, targetWorkspaceId);
    await sendAcceptanceEmail(shareId, result.targetWorkspaceId, result.listId, email);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signed in, but could not accept shared list.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}