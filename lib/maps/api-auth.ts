import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  console.error("[maps api]", err);
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    if (typeof e.message === "string" && e.message) {
      const missingTable =
        e.code === "PGRST205" ||
        /Could not find the table/i.test(e.message) ||
        /schema cache/i.test(e.message);
      if (missingTable) {
        return jsonError(
          "Map tables are not installed. Run supabase/add-maps-territories-stores.sql on Supabase.",
          503,
        );
      }
      return jsonError(e.message, 500);
    }
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  return jsonError(message, 500);
}

export type MapsSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** Loose client for map_* tables/RPCs until generated Database types include Relationships. */
export type MapsDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export function mapsDb(supabase: MapsSupabaseClient): MapsDb {
  return supabase as unknown as MapsDb;
}

export type MapsAuthContext = {
  supabase: MapsSupabaseClient;
  user: User;
  workspaceId: string;
};

/**
 * Authenticated workspace member required for all map APIs.
 */
export async function requireMapsWorkspaceMember(
  workspaceId: string | null | undefined,
): Promise<MapsAuthContext | NextResponse> {
  const id = workspaceId?.trim();
  if (!id) {
    return jsonError("workspaceId is required", 400);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return jsonError(memberError.message || "Could not verify membership", 500);
  }

  if (!membership) {
    return jsonError("Forbidden: not a workspace member", 403);
  }

  return { supabase, user, workspaceId: id };
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
