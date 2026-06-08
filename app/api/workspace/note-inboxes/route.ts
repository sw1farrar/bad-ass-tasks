import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createWorkspaceNoteInbox,
  listWorkspaceNoteInboxes,
} from "@/lib/email-inbox/noteInboxService";

type CreateBody = {
  workspaceId?: string;
};

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const inboxes = await listWorkspaceNoteInboxes(workspaceId, user.id);
    return NextResponse.json({ ok: true, inboxes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "inbox_list_failed";
    const status = message === "not_a_member" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const inbox = await createWorkspaceNoteInbox({
      workspaceId,
      userId: user.id,
    });
    return NextResponse.json({ ok: true, inbox });
  } catch (err) {
    const message = err instanceof Error ? err.message : "inbox_create_failed";
    const status =
      message === "not_a_member"
        ? 403
        : message === "demo_workspace" || message === "inbox_already_exists"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}