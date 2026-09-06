import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import {
  McpAccessTokenError,
  createMcpAccessToken,
  listMcpAccessTokens,
} from "@/lib/mcp/accessTokens";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

function tokenError(err: unknown) {
  if (err instanceof McpAccessTokenError) {
    const status =
      err.code === "limit_reached" || err.code === "invalid_name"
        ? 400
        : err.code === "table_missing" || err.code === "not_configured"
          ? 503
          : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  return NextResponse.json({ error: "Token request failed." }, { status: 500 });
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  try {
    const tokens = await listMcpAccessTokens(auth.user!.id);
    return NextResponse.json({ ok: true, tokens });
  } catch (err) {
    return tokenError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;

  const rate = checkRateLimit(`mcp-pat-create:${auth.user!.id}`, 8, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many tokens created. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let name: string | undefined;
  try {
    const body = (await request.json()) as { name?: string };
    name = body.name;
  } catch {
    name = undefined;
  }

  try {
    const created = await createMcpAccessToken(auth.user!.id, name);
    return NextResponse.json({ ok: true, token: created.token, summary: created.summary });
  } catch (err) {
    return tokenError(err);
  }
}
