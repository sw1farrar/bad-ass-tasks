import { NextResponse } from "next/server";
import { isBrevoInboundWebhookAuthorized } from "@/lib/brevo/inboundConfig";
import { processInboundEmail } from "@/lib/brevo/processInboundEmail";
import type { BrevoInboundWebhookPayload } from "@/lib/brevo/inboundTypes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isBrevoInboundWebhookAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: BrevoInboundWebhookPayload;
  try {
    payload = (await request.json()) as BrevoInboundWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await processInboundEmail(payload);

  if (!result.ok) {
    const status =
      result.reason === "supabase_admin_not_configured" ||
      result.reason === "note_email_inboxes_table_missing" ||
      result.reason === "task_email_inboxes_table_missing"
        ? 503
        : result.reason === "empty_payload"
          ? 400
          : 500;

    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  if (result.status === "ignored") {
    return NextResponse.json({ ok: true, ignored: true, reason: result.reason });
  }

  if (result.status === "duplicate") {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      kind: result.kind,
      noteId: result.noteId,
      taskId: result.taskId,
      messageId: result.messageId,
    });
  }

  return NextResponse.json({
    ok: true,
    kind: result.kind,
    noteId: result.noteId,
    taskId: result.taskId,
    inboxId: result.inboxId,
    localPart: result.localPart,
  });
}