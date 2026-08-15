import type { MissionType, TerritoryType } from "./constants";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export type StoreStatus = "active" | "inactive";
export type TerritoryStatus = "active" | "draft" | "archived";

export interface MapStore {
  id: string;
  workspace_id: string;
  name: string;
  store_number: string | null;
  address: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  mission_types: MissionType[];
  notes: string | null;
  status: StoreStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface MapTerritory {
  id: string;
  workspace_id: string;
  name: string;
  territory_type: TerritoryType;
  geojson: Polygon | MultiPolygon;
  color: string | null;
  notes: string | null;
  status: TerritoryStatus;
  assigned_person: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface OverlapResult {
  id: string;
  name: string;
  territory_type: string;
}

export type TerritoryGeoFeature = Feature<
  Polygon | MultiPolygon,
  {
    id?: string;
    name?: string;
    territory_type?: TerritoryType;
    color?: string;
    status?: TerritoryStatus;
  }
>;

export interface LayerVisibility {
  territories: Record<TerritoryType, boolean>;
  missions: Record<MissionType, boolean>;
  showInactiveStores: boolean;
  showArchivedTerritories: boolean;
  showDraftTerritories: boolean;
}

export interface SnapSettings {
  enabled: boolean;
  tolerancePx: number;
  snapToTerritories: boolean;
  snapToRoads: boolean;
}
