export const TERRITORY_TYPES = [
  "Commercial",
  "Property Management",
  "Residential Repaint",
  "Protective and Marine",
  "High Performance Flooring",
] as const;

export type TerritoryType = (typeof TERRITORY_TYPES)[number];

export const TERRITORY_COLORS: Record<TerritoryType, string> = {
  Commercial: "#3b82f6",
  "Property Management": "#8b5cf6",
  "Residential Repaint": "#22c55e",
  "Protective and Marine": "#06b6d4",
  "High Performance Flooring": "#f59e0b",
};

export const MISSION_TYPES = [
  "Residential Repaint",
  "Pro Store",
  "Commercial Store",
  "High Performance Flooring",
] as const;

export type MissionType = (typeof MISSION_TYPES)[number];

export const MISSION_COLORS: Record<MissionType, string> = {
  "Residential Repaint": "#22c55e",
  "Pro Store": "#f97316",
  "Commercial Store": "#3b82f6",
  "High Performance Flooring": "#f59e0b",
};

export const STORE_STATUSES = ["active", "inactive"] as const;
export const TERRITORY_STATUSES = ["active", "draft", "archived"] as const;

export const DEFAULT_MAP_CENTER: [number, number] = [-98.5795, 39.8283];
export const DEFAULT_MAP_ZOOM = 4;

/** Columns safe to return over JSON (excludes PostGIS geography). */
export const MAP_STORE_SELECT =
  "id, workspace_id, name, store_number, address, city, state, postal_code, country, latitude, longitude, mission_types, notes, status, created_at, updated_at, created_by, updated_by";

export const MAP_TERRITORY_SELECT =
  "id, workspace_id, name, territory_type, geojson, color, notes, status, assigned_person, created_at, updated_at, created_by, updated_by";
