import {
  MISSION_COLORS,
  MISSION_TYPES,
  TERRITORY_COLORS,
  TERRITORY_TYPES,
  type MissionType,
  type TerritoryType,
} from "./constants";
import type { MapStore, MapTerritory, LayerVisibility } from "./types";
import type { FeatureCollection, Point, Polygon, MultiPolygon } from "geojson";

export function defaultLayerVisibility(): LayerVisibility {
  return {
    territories: Object.fromEntries(TERRITORY_TYPES.map((t) => [t, true])) as Record<
      TerritoryType,
      boolean
    >,
    missions: Object.fromEntries(MISSION_TYPES.map((t) => [t, true])) as Record<
      MissionType,
      boolean
    >,
    showInactiveStores: false,
    showArchivedTerritories: false,
    showDraftTerritories: true,
  };
}

export function territoriesToFC(
  territories: MapTerritory[],
  visibility: LayerVisibility,
): FeatureCollection<Polygon | MultiPolygon> {
  const features = territories
    .filter((t) => {
      if (!visibility.territories[t.territory_type]) return false;
      if (t.status === "archived" && !visibility.showArchivedTerritories) return false;
      if (t.status === "draft" && !visibility.showDraftTerritories) return false;
      return true;
    })
    .map((t) => ({
      type: "Feature" as const,
      id: t.id,
      properties: {
        id: t.id,
        name: t.name,
        territory_type: t.territory_type,
        color: t.color || TERRITORY_COLORS[t.territory_type] || "#64748b",
        status: t.status,
        assigned_person: t.assigned_person,
      },
      geometry: t.geojson,
    }));

  return { type: "FeatureCollection", features };
}

export function storesToFC(
  stores: MapStore[],
  visibility: LayerVisibility,
): FeatureCollection<Point> {
  const features = stores
    .filter((s) => {
      if (s.latitude == null || s.longitude == null) return false;
      if (s.status === "inactive" && !visibility.showInactiveStores) return false;
      if (s.mission_types.length === 0) return true;
      return s.mission_types.some((m) => visibility.missions[m]);
    })
    .map((s) => {
      const primary = s.mission_types[0] as MissionType | undefined;
      const color = primary ? MISSION_COLORS[primary] : "#64748b";
      return {
        type: "Feature" as const,
        id: s.id,
        properties: {
          id: s.id,
          name: s.name,
          store_number: s.store_number,
          address: s.address,
          status: s.status,
          mission_types: s.mission_types.join(", "),
          color,
          primary_mission: primary ?? "Other",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [s.longitude!, s.latitude!],
        },
      };
    });

  return { type: "FeatureCollection", features };
}

export const TERRITORY_SOURCE = "territories";
export const TERRITORY_FILL = "territories-fill";
export const TERRITORY_LINE = "territories-line";
export const TERRITORY_HIGHLIGHT = "territories-highlight";
export const STORE_SOURCE = "stores";
export const STORE_CIRCLE = "stores-circle";
export const STORE_LABEL = "stores-label";
export const OVERLAP_SOURCE = "overlap-warning";
export const OVERLAP_FILL = "overlap-warning-fill";
export const OVERLAP_LINE = "overlap-warning-line";
export const SNAP_SOURCE = "snap-indicator";
export const SNAP_CIRCLE = "snap-indicator-circle";
