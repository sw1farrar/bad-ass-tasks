import { NextResponse } from "next/server";
import { getInvitePreview, isValidInviteId } from "@/lib/invite/getInvitePreview";

type RouteContext = { params: Promise<{ inviteId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { inviteId } = await context.params;

  if (!isValidInviteId(inviteId)) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 400 });
  }

  const preview = await getInvitePreview(inviteId);
  if (!preview) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({ invite: preview });
}