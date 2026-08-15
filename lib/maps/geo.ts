import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import * as turf from "@turf/turf";
import type { OverlapResult } from "./types";
import type { TerritoryType } from "./constants";

export function normalizePolygonGeoJSON(input: unknown): Polygon | MultiPolygon {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid geometry");
  }

  const obj = input as Record<string, unknown>;

  if (obj.type === "Feature" && obj.geometry) {
    return normalizePolygonGeoJSON(obj.geometry);
  }

  if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
    const first = (obj.features as unknown[]).find((f) => {
      const g = (f as { geometry?: { type?: string } })?.geometry;
      return g?.type === "Polygon" || g?.type === "MultiPolygon";
    });
    if (!first) throw new Error("No polygon found in FeatureCollection");
    return normalizePolygonGeoJSON(first);
  }

  if (obj.type === "Polygon") {
    return closeRings(obj as unknown as Polygon);
  }

  if (obj.type === "MultiPolygon") {
    return closeRingsMulti(obj as unknown as MultiPolygon);
  }

  throw new Error("Geometry must be Polygon or MultiPolygon");
}

function closeRing(ring: Position[]): Position[] {
  if (ring.length < 3) throw new Error("Ring needs at least 3 positions");
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, first];
  }
  return ring;
}

function closeRings(poly: Polygon): Polygon {
  return {
    type: "Polygon",
    coordinates: poly.coordinates.map(closeRing),
  };
}

function closeRingsMulti(mp: MultiPolygon): MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: mp.coordinates.map((poly) => poly.map(closeRing)),
  };
}

export function toFeature(
  geometry: Polygon | MultiPolygon,
  properties: Record<string, unknown> = {},
): Feature<Polygon | MultiPolygon> {
  return {
    type: "Feature",
    properties,
    geometry,
  };
}

/** Client-side overlap check with Turf (real-time feedback). Edge touches are OK. */
export function findOverlapsClient(
  candidate: Polygon | MultiPolygon,
  others: Array<{
    id: string;
    name: string;
    territory_type: TerritoryType | string;
    geojson: Polygon | MultiPolygon;
  }>,
  territoryType: string,
  excludeId?: string | null,
): OverlapResult[] {
  const a = turf.feature(candidate);
  const results: OverlapResult[] = [];

  for (const other of others) {
    if (other.territory_type !== territoryType) continue;
    if (excludeId && other.id === excludeId) continue;
    try {
      const b = turf.feature(other.geojson);
      if (turf.booleanDisjoint(a, b)) continue;

      try {
        const inter = turf.intersect(turf.featureCollection([a, b]));
        if (inter) {
          const area = turf.area(inter);
          if (area > 1) {
            results.push({
              id: other.id,
              name: other.name,
              territory_type: other.territory_type,
            });
            continue;
          }
        }
      } catch {
        /* fall through */
      }

      if (
        turf.booleanOverlap(a, b) ||
        turf.booleanContains(a, b) ||
        turf.booleanContains(b, a)
      ) {
        results.push({
          id: other.id,
          name: other.name,
          territory_type: other.territory_type,
        });
      }
    } catch {
      /* ignore malformed */
    }
  }

  return results;
}

export function storesInsideGeometry(
  geometry: Polygon | MultiPolygon,
  stores: Array<{ id: string; latitude: number | null; longitude: number | null }>,
) {
  const poly = turf.feature(geometry);
  return stores.filter((s) => {
    if (s.latitude == null || s.longitude == null) return false;
    try {
      return turf.booleanPointInPolygon(turf.point([s.longitude, s.latitude]), poly);
    } catch {
      return false;
    }
  });
}

export function snapToTerritories(
  lng: number,
  lat: number,
  territories: Array<{ geojson: Polygon | MultiPolygon }>,
  toleranceMeters: number,
): { lng: number; lat: number; snapped: boolean } {
  const pt = turf.point([lng, lat]);
  let best: { lng: number; lat: number; dist: number } | null = null;

  for (const t of territories) {
    try {
      const feature = turf.feature(t.geojson);
      const coords = turf.coordAll(feature);

      for (const c of coords) {
        const d = turf.distance(pt, turf.point(c), { units: "meters" });
        if (d <= toleranceMeters && (!best || d < best.dist)) {
          best = { lng: c[0], lat: c[1], dist: d };
        }
      }

      const lines = turf.polygonToLine(feature as Feature<Polygon | MultiPolygon>);
      const lineFeatures = lines.type === "FeatureCollection" ? lines.features : [lines];

      for (const line of lineFeatures) {
        const nearest = turf.nearestPointOnLine(line, pt, { units: "meters" });
        const d = nearest.properties.dist ?? Infinity;
        if (d <= toleranceMeters && (!best || d < best.dist)) {
          best = {
            lng: nearest.geometry.coordinates[0],
            lat: nearest.geometry.coordinates[1],
            dist: d,
          };
        }
      }
    } catch {
      /* skip bad geom */
    }
  }

  if (best) {
    return { lng: best.lng, lat: best.lat, snapped: true };
  }
  return { lng, lat, snapped: false };
}

export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

export function boundsFromStoresAndTerritories(
  stores: Array<{ latitude: number | null; longitude: number | null }>,
  territories: Array<{ geojson: Polygon | MultiPolygon }>,
): [[number, number], [number, number]] | null {
  const features: Feature[] = [];

  for (const s of stores) {
    if (s.latitude != null && s.longitude != null) {
      features.push(turf.point([s.longitude, s.latitude]));
    }
  }
  for (const t of territories) {
    try {
      features.push(turf.feature(t.geojson));
    } catch {
      /* skip */
    }
  }

  if (features.length === 0) return null;
  const bbox = turf.bbox(turf.featureCollection(features));
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}
