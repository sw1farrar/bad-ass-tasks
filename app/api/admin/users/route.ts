import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/auth/isSiteAdmin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  createPlatformUser,
  fetchPlatformUsers,
  setUserAccessPaused,
  deletePlatformUser,
} from "@/lib/admin/platformData";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Admin API is not configured on the server." }, { status: 503 });
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await fetchPlatformUsers();
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateUserBody = {
  email?: string;
  password?: string;
  fullName?: string;
};

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Admin API is not configured on the server." }, { status: 503 });
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password?.trim() ?? "";
  const fullName = body.fullName?.trim();

  if (!email || !email.includes("@") || password.length < 6) {
    return NextResponse.json(
      { error: "A valid email and password (min 6 characters) are required." },
      { status: 400 }
    );
  }

  const result = await createPlatformUser({ email, password, fullName });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: result.userId });
}

type PatchUserBody = {
  userId?: string;
  action?: "pause" | "unpause";
  reason?: string;
};

export async function PATCH(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Admin API is not configured on the server." }, { status: 503 });
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PatchUserBody;
  try {
    body = (await request.json()) as PatchUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: "You cannot pause your own account" }, { status: 400 });
  }

  if (body.action === "pause") {
    const result = await setUserAccessPaused(userId, true, body.reason);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, paused: true });
  }

  if (body.action === "unpause") {
    const result = await setUserAccessPaused(userId, false);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, paused: false });
  }

  return NextResponse.json({ error: "action must be pause or unpause" }, { status: 400 });
}

type DeleteUserBody = {
  userId?: string;
};

export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Admin API is not configured on the server." }, { status: 503 });
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DeleteUserBody;
  try {
    body = (await request.json()) as DeleteUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account from here" }, { status: 400 });
  }

  const result = await deletePlatformUser(userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}