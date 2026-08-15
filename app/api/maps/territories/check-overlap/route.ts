import { NextRequest } from "next/server";
import {
  handleApiError,
  isNextResponse,
  jsonError,
  jsonOk,
  mapsDb,
  requireMapsWorkspaceMember,
} from "@/lib/maps/api-auth";
import { findOverlapsClient, normalizePolygonGeoJSON } from "@/lib/maps/geo";
import { checkOverlapSchema } from "@/lib/maps/validations";
import type { MapTerritory } from "@/lib/maps/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkOverlapSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const auth = await requireMapsWorkspaceMember(parsed.data.workspaceId);
    if (isNextResponse(auth)) return auth;

    let geojson;
    try {
      geojson = normalizePolygonGeoJSON(parsed.data.geojson);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Invalid geometry");
    }

    const db = mapsDb(auth.supabase);
    const { data: overlaps, error } = await db.rpc("check_map_territory_overlap", {
      p_workspace_id: auth.workspaceId,
      p_geojson: geojson,
      p_territory_type: parsed.data.territory_type,
      p_exclude_id: parsed.data.exclude_id ?? null,
    });

    if (!error) {
      return jsonOk({
        hasOverlap: (overlaps?.length ?? 0) > 0,
        overlaps: overlaps ?? [],
      });
    }

    console.warn("PostGIS overlap RPC failed, using Turf fallback", error);
    const { data: territories } = await db
      .from("map_territories")
      .select("id, name, territory_type, geojson, status")
      .eq("workspace_id", auth.workspaceId)
      .neq("status", "archived");

    const results = findOverlapsClient(
      geojson,
      (territories as MapTerritory[]) ?? [],
      parsed.data.territory_type,
      parsed.data.exclude_id,
    );

    return jsonOk({ hasOverlap: results.length > 0, overlaps: results });
  } catch (err) {
    return handleApiError(err);
  }
}
