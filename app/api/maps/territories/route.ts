import { NextRequest } from "next/server";
import {
  handleApiError,
  isNextResponse,
  jsonError,
  jsonOk,
  mapsDb,
  requireMapsWorkspaceMember,
} from "@/lib/maps/api-auth";
import { MAP_TERRITORY_SELECT, TERRITORY_COLORS, type TerritoryType } from "@/lib/maps/constants";
import { normalizePolygonGeoJSON } from "@/lib/maps/geo";
import { territorySchema } from "@/lib/maps/validations";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    const auth = await requireMapsWorkspaceMember(workspaceId);
    if (isNextResponse(auth)) return auth;

    const q = req.nextUrl.searchParams.get("q");
    const db = mapsDb(auth.supabase);
    let query = db
      .from("map_territories")
      .select(MAP_TERRITORY_SELECT)
      .eq("workspace_id", auth.workspaceId)
      .order("name");

    if (q && q.trim()) {
      query = query.ilike("name", `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ territories: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await requireMapsWorkspaceMember(body.workspaceId as string | undefined);
    if (isNextResponse(auth)) return auth;

    const parsed = territorySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    let geojson;
    try {
      geojson = normalizePolygonGeoJSON(parsed.data.geojson);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Invalid geometry");
    }

    const db = mapsDb(auth.supabase);

    if (parsed.data.status !== "archived") {
      const { data: overlaps, error: oErr } = await db.rpc("check_map_territory_overlap", {
        p_workspace_id: auth.workspaceId,
        p_geojson: geojson,
        p_territory_type: parsed.data.territory_type,
        p_exclude_id: null,
      });
      if (oErr) throw oErr;
      if (overlaps && overlaps.length > 0) {
        return jsonError(
          `Same-type overlap with: ${overlaps.map((o: { name: string }) => o.name).join(", ")}`,
          409,
        );
      }
    }

    const color =
      parsed.data.color || TERRITORY_COLORS[parsed.data.territory_type as TerritoryType];

    const { data, error } = await db
      .from("map_territories")
      .insert({
        workspace_id: auth.workspaceId,
        name: parsed.data.name,
        territory_type: parsed.data.territory_type,
        geojson,
        color,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        assigned_person: parsed.data.assigned_person ?? null,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select(MAP_TERRITORY_SELECT)
      .single();

    if (error) throw error;
    return jsonOk({ territory: data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
