import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getInvitePreview, isValidInviteId } from "@/lib/invite/getInvitePreview";

type RouteContext = { params: Promise<{ inviteId: string }> };

type JoinBody = {
  email?: string;
  password?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function acceptInviteForUser(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, inviteId: string) {
  type RpcClient = {
    rpc: (
      name: string,
      args: { p_invite_id: string },
    ) => Promise<{ data: string | null; error: { message?: string } | null }>;
  };
  const { data, error } = await (supabase as unknown as RpcClient).rpc("accept_workspace_invite", {
    p_invite_id: inviteId,
  });

  if (error) {
    throw new Error(error.message || "Could not accept invitation.");
  }

  return data as string;
}

export async function POST(request: Request, context: RouteContext) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Invite acceptance is not configured on the server." },
      { status: 503 },
    );
  }

  const { inviteId } = await context.params;
  if (!isValidInviteId(inviteId)) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 400 });
  }

  const preview = await getInvitePreview(inviteId);
  if (!preview) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (!preview.isValid) {
    return NextResponse.json({ error: preview.invalidReason || "Invite is no longer valid" }, { status: 409 });
  }

  let body: JoinBody;
  try {
    body = (await request.json()) as JoinBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (sessionUser) {
    if (
      preview.email &&
      sessionUser.email &&
      normalizeEmail(sessionUser.email) !== normalizeEmail(preview.email)
    ) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address. Sign out and open the link again." },
        { status: 403 },
      );
    }

    try {
      const workspaceId = await acceptInviteForUser(supabase, inviteId);
      await supabase.from("profiles").upsert({ id: sessionUser.id } as never, { onConflict: "id" });
      return NextResponse.json({ ok: true, workspaceId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not accept invitation.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const password = body.password?.trim() ?? "";
  const requestedEmail = body.email ? normalizeEmail(body.email) : "";
  const inviteEmail = preview.email ? normalizeEmail(preview.email) : "";
  const email = inviteEmail || requestedEmail;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (inviteEmail && requestedEmail && inviteEmail !== requestedEmail) {
    return NextResponse.json({ error: "This invite was sent to a different email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError && !/already|registered|exists/i.test(createError.message)) {
    return NextResponse.json({ error: createError.message || "Could not create account." }, { status: 400 });
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.user) {
    const message = createError
      ? "An account already exists for this email. Enter the correct password to join."
      : signInError?.message || "Could not sign you in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const workspaceId = await acceptInviteForUser(supabase, inviteId);
    await supabase.from("profiles").upsert({ id: signInData.user.id } as never, { onConflict: "id" });
    return NextResponse.json({ ok: true, workspaceId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signed in, but could not accept invitation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}