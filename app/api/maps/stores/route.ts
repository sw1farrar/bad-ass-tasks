import { NextRequest } from "next/server";
import {
  handleApiError,
  isNextResponse,
  jsonError,
  jsonOk,
  mapsDb,
  requireMapsWorkspaceMember,
} from "@/lib/maps/api-auth";
import { MAP_STORE_SELECT } from "@/lib/maps/constants";
import { geocodeAddress } from "@/lib/maps/geocode";
import { storeSchema } from "@/lib/maps/validations";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    const auth = await requireMapsWorkspaceMember(workspaceId);
    if (isNextResponse(auth)) return auth;

    const q = req.nextUrl.searchParams.get("q");
    const db = mapsDb(auth.supabase);
    const wsId = auth.workspaceId;

    if (q && q.trim()) {
      const { data, error } = await db.rpc("search_map_stores", {
        p_workspace_id: wsId,
        p_query: q.trim(),
      });
      if (error) throw error;
      return jsonOk({ stores: data ?? [] });
    }

    const { data, error } = await db
      .from("map_stores")
      .select(MAP_STORE_SELECT)
      .eq("workspace_id", wsId)
      .order("name");

    if (error) throw error;
    return jsonOk({ stores: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = (body.workspaceId as string | undefined) ?? null;
    const auth = await requireMapsWorkspaceMember(workspaceId);
    if (isNextResponse(auth)) return auth;

    const parsed = storeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const payload = { ...parsed.data };

    if ((payload.latitude == null || payload.longitude == null) && payload.address) {
      try {
        const geo = await geocodeAddress(
          [payload.address, payload.city, payload.state, payload.postal_code, payload.country]
            .filter(Boolean)
            .join(", "),
        );
        if (geo) {
          payload.latitude = geo.latitude;
          payload.longitude = geo.longitude;
        }
      } catch (e) {
        console.warn("Geocode failed", e);
      }
    }

    const db = mapsDb(auth.supabase);
    const { data, error } = await db
      .from("map_stores")
      .insert({
        ...payload,
        workspace_id: auth.workspaceId,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select(MAP_STORE_SELECT)
      .single();

    if (error) throw error;
    return jsonOk({ store: data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
