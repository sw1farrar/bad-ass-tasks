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
import type { MapStore } from "@/lib/maps/types";

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
    const { data, error } = await db
      .from("map_stores")
      .select(MAP_STORE_SELECT)
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return jsonError("Store not found", 404);
      throw error;
    }
    return jsonOk({ store: data });
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

    const parsed = storeSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const db = mapsDb(auth.supabase);
    const { data: before } = (await db
      .from("map_stores")
      .select(MAP_STORE_SELECT)
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .single()) as { data: MapStore | null };

    if (!before) return jsonError("Store not found", 404);

    const payload = { ...parsed.data };
    const addressChanged =
      payload.address !== undefined ||
      payload.city !== undefined ||
      payload.state !== undefined ||
      payload.postal_code !== undefined;

    const wantsGeocode =
      addressChanged && payload.latitude === undefined && payload.longitude === undefined;

    if (wantsGeocode) {
      const address = [
        payload.address ?? before.address,
        payload.city ?? before.city,
        payload.state ?? before.state,
        payload.postal_code ?? before.postal_code,
        payload.country ?? before.country,
      ]
        .filter(Boolean)
        .join(", ");
      try {
        const geo = await geocodeAddress(address);
        if (geo) {
          payload.latitude = geo.latitude;
          payload.longitude = geo.longitude;
        }
      } catch (e) {
        console.warn("Geocode failed", e);
      }
    }

    const { data, error } = await db
      .from("map_stores")
      .update({ ...payload, updated_by: auth.user.id })
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .select(MAP_STORE_SELECT)
      .single();

    if (error) throw error;
    return jsonOk({ store: data });
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
      .from("map_stores")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();

    if (!before) return jsonError("Store not found", 404);

    const { error } = await db
      .from("map_stores")
      .delete()
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId);

    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
