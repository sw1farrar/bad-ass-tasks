import { NextRequest } from "next/server";
import {
  handleApiError,
  isNextResponse,
  jsonError,
  jsonOk,
  mapsDb,
  requireMapsWorkspaceMember,
} from "@/lib/maps/api-auth";
import { MAP_TERRITORY_SELECT } from "@/lib/maps/constants";
import { normalizePolygonGeoJSON } from "@/lib/maps/geo";
import { territorySchema } from "@/lib/maps/validations";
import type { MapTerritory } from "@/lib/maps/types";

async function resolveWorkspaceId(
  req: NextRequest,
  body?: { workspaceId?: string },
): Promise<string | null> {
  return (
    body?.workspaceId?.trim() ||
    req.nextUrl.searchParams.get("workspaceId")?.trim() ||
    null
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await requireMapsWorkspaceMember(await resolveWorkspaceId(req));
    if (isNextResponse(auth)) return auth;

    const db = mapsDb(auth.supabase);
    const { data: territory, error } = await db
      .from("map_territories")
      .select(MAP_TERRITORY_SELECT)
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return jsonError("Territory not found", 404);
      throw error;
    }

    const { data: stores } = await db.rpc("map_stores_in_territory", {
      p_territory_id: id,
    });

    return jsonOk({ territory, stores: stores ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const auth = await requireMapsWorkspaceMember(await resolveWorkspaceId(req, body));
    if (isNextResponse(auth)) return auth;

    const parsed = territorySchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const db = mapsDb(auth.supabase);
    const { data: before } = (await db
      .from("map_territories")
      .select(MAP_TERRITORY_SELECT)
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .single()) as { data: MapTerritory | null };

    if (!before) return jsonError("Territory not found", 404);

    const update: Record<string, unknown> = {
      updated_by: auth.user.id,
    };

    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.territory_type !== undefined)
      update.territory_type = parsed.data.territory_type;
    if (parsed.data.color !== undefined) update.color = parsed.data.color;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.assigned_person !== undefined)
      update.assigned_person = parsed.data.assigned_person;

    let geojson = before.geojson;
    if (parsed.data.geojson !== undefined) {
      try {
        geojson = normalizePolygonGeoJSON(parsed.data.geojson);
        update.geojson = geojson;
      } catch (e) {
        return jsonError(e instanceof Error ? e.message : "Invalid geometry");
      }
    }

    const territoryType = (update.territory_type as string) ?? before.territory_type;
    const status = (update.status as string) ?? before.status;

    if (status !== "archived") {
      const { data: overlaps, error: oErr } = await db.rpc("check_map_territory_overlap", {
        p_workspace_id: auth.workspaceId,
        p_geojson: geojson,
        p_territory_type: territoryType,
        p_exclude_id: id,
      });
      if (oErr) throw oErr;
      if (overlaps && overlaps.length > 0) {
        return jsonError(
          `Same-type overlap with: ${overlaps.map((o: { name: string }) => o.name).join(", ")}`,
          409,
        );
      }
    }

    const { data, error } = await db
      .from("map_territories")
      .update(update)
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .select(MAP_TERRITORY_SELECT)
      .single();

    if (error) throw error;
    return jsonOk({ territory: data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await requireMapsWorkspaceMember(await resolveWorkspaceId(req));
    if (isNextResponse(auth)) return auth;

    const db = mapsDb(auth.supabase);
    const { data: before } = await db
      .from("map_territories")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();

    if (!before) return jsonError("Territory not found", 404);

    const { error } = await db
      .from("map_territories")
      .delete()
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId);

    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
