import { NextRequest } from "next/server";
import Papa from "papaparse";
import {
  handleApiError,
  isNextResponse,
  jsonError,
  jsonOk,
  mapsDb,
  requireMapsWorkspaceMember,
} from "@/lib/maps/api-auth";
import { MAP_STORE_SELECT, MISSION_TYPES, type MissionType } from "@/lib/maps/constants";
import { geocodeAddress } from "@/lib/maps/geocode";
import type { MapStore } from "@/lib/maps/types";

function parseMissionTypes(raw: string | undefined): MissionType[] {
  if (!raw) return [];
  const parts = raw
    .split(/[|;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set<string>(MISSION_TYPES);
  return parts.filter((p) => allowed.has(p)) as MissionType[];
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const workspaceId =
      (form.get("workspaceId") as string | null) ??
      req.nextUrl.searchParams.get("workspaceId");
    const auth = await requireMapsWorkspaceMember(workspaceId);
    if (isNextResponse(auth)) return auth;

    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("CSV file is required (field: file)");
    }

    const MAX_CSV_BYTES = 1_000_000;
    const MAX_ROWS = 500;
    const MAX_GEOCODES = 50;

    if (file.size > MAX_CSV_BYTES) {
      return jsonError(`CSV too large (max ${MAX_CSV_BYTES} bytes)`, 413);
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (parsed.errors.length) {
      return jsonError(`CSV parse error: ${parsed.errors[0]?.message ?? "unknown"}`);
    }

    if (parsed.data.length > MAX_ROWS) {
      return jsonError(`CSV has too many rows (max ${MAX_ROWS})`, 400);
    }

    const db = mapsDb(auth.supabase);
    const created: MapStore[] = [];
    const errors: string[] = [];
    let geocodeCount = 0;

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const name = (row.name || row.store_name || row.store || "").slice(0, 200);
      const address = (row.address || row.full_address || row.street_address || "").slice(0, 500);
      if (!name || !address) {
        errors.push(`Row ${i + 2}: missing name or address`);
        continue;
      }

      let latitude: number | null = row.latitude
        ? Number(row.latitude)
        : row.lat
          ? Number(row.lat)
          : null;
      let longitude: number | null = row.longitude
        ? Number(row.longitude)
        : row.lng
          ? Number(row.lng)
          : row.lon
            ? Number(row.lon)
            : null;

      if (
        (latitude == null || Number.isNaN(latitude) || longitude == null) &&
        address &&
        geocodeCount < MAX_GEOCODES
      ) {
        try {
          const full = [address, row.city, row.state, row.postal_code || row.zip]
            .filter(Boolean)
            .join(", ")
            .slice(0, 500);
          const geo = await geocodeAddress(full);
          geocodeCount += 1;
          if (geo) {
            latitude = geo.latitude;
            longitude = geo.longitude;
          }
        } catch {
          /* continue without coords */
        }
      }

      const mission_types = parseMissionTypes(
        row.mission_types || row.missions || row.mission_type,
      );

      const { data, error } = await db
        .from("map_stores")
        .insert({
          workspace_id: auth.workspaceId,
          name,
          store_number: row.store_number || row.number || null,
          address,
          city: row.city || null,
          state: row.state || null,
          postal_code: row.postal_code || row.zip || null,
          country: row.country || "US",
          latitude: Number.isFinite(latitude as number) ? latitude : null,
          longitude: Number.isFinite(longitude as number) ? longitude : null,
          mission_types,
          notes: row.notes || null,
          status:
            (row.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
          created_by: auth.user.id,
          updated_by: auth.user.id,
        })
        .select(MAP_STORE_SELECT)
        .single();

      if (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      } else if (data) {
        created.push(data as MapStore);
      }
    }

    return jsonOk({
      imported: created.length,
      stores: created,
      errors,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
