import { z } from "zod";
import { MISSION_TYPES, TERRITORY_TYPES } from "./constants";

/** Cap GeoJSON payload size to limit PostGIS / Turf CPU DoS. */
export const MAX_GEOJSON_BYTES = 200_000;

const geojsonSchema = z
  .unknown()
  .refine(
    (v) => {
      try {
        return JSON.stringify(v).length <= MAX_GEOJSON_BYTES;
      } catch {
        return false;
      }
    },
    { message: `GeoJSON too large (max ${MAX_GEOJSON_BYTES} bytes)` },
  )
  .refine(
    (v) => v !== null && typeof v === "object" && !Array.isArray(v),
    { message: "GeoJSON must be an object" },
  );

export const storeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  store_number: z.string().max(50).optional().nullable(),
  address: z.string().min(1, "Address is required").max(500),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  country: z.string().max(60).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  mission_types: z.array(z.enum(MISSION_TYPES)).default([]),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const territorySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  territory_type: z.enum(TERRITORY_TYPES),
  geojson: geojsonSchema,
  color: z.string().max(20).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  assigned_person: z.string().max(200).optional().nullable(),
});

export const geocodeSchema = z.object({
  address: z.string().min(1).max(500),
});

export const checkOverlapSchema = z.object({
  workspaceId: z.string().uuid(),
  geojson: geojsonSchema,
  territory_type: z.enum(TERRITORY_TYPES),
  exclude_id: z.string().uuid().optional().nullable(),
});

export const workspaceIdSchema = z.string().uuid("workspaceId is required");
