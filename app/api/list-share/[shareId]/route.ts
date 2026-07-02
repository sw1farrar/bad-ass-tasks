import { NextResponse } from "next/server";
import { getListSharePreview, isValidListShareId } from "@/lib/list-share/getListSharePreview";

type RouteContext = { params: Promise<{ shareId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { shareId } = await context.params;

  if (!isValidListShareId(shareId)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  const preview = await getListSharePreview(shareId);
  if (!preview) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json({ share: preview });
}