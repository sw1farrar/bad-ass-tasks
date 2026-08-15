-- Maps feature: workspace-scoped stores + territories (PostGIS)
-- Run in Supabase SQL editor after base schema. Prefer map_stores / map_territories
-- to avoid clashing with generic table names.
-- Apply: node scripts/apply-supabase-sql.mjs supabase/add-maps-territories-stores.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Shared updated_at helper (safe if already present)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- map_stores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS map_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  store_number TEXT,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  mission_types TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_map_stores_workspace ON map_stores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_map_stores_location ON map_stores USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_map_stores_status ON map_stores(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_map_stores_name_fts ON map_stores
  USING gin (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(store_number, '') || ' ' || coalesce(address, '')));

-- ---------------------------------------------------------------------------
-- map_territories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS map_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  territory_type TEXT NOT NULL CHECK (
    territory_type IN (
      'Commercial',
      'Property Management',
      'Residential Repaint',
      'Protective and Marine',
      'High Performance Flooring'
    )
  ),
  geometry GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  geojson JSONB NOT NULL,
  color TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  assigned_person TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_map_territories_workspace ON map_territories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_map_territories_geometry ON map_territories USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_map_territories_type ON map_territories(workspace_id, territory_type);
CREATE INDEX IF NOT EXISTS idx_map_territories_status ON map_territories(workspace_id, status);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS map_stores_updated_at ON map_stores;
CREATE TRIGGER map_stores_updated_at
  BEFORE UPDATE ON map_stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS map_territories_updated_at ON map_territories;
CREATE TRIGGER map_territories_updated_at
  BEFORE UPDATE ON map_territories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION map_sync_store_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS map_stores_sync_location ON map_stores;
CREATE TRIGGER map_stores_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON map_stores
  FOR EACH ROW EXECUTE FUNCTION map_sync_store_location();

CREATE OR REPLACE FUNCTION map_sync_territory_geometry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geometry = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(NEW.geojson::text), 4326))::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS map_territories_sync_geometry ON map_territories;
CREATE TRIGGER map_territories_sync_geometry
  BEFORE INSERT OR UPDATE OF geojson ON map_territories
  FOR EACH ROW EXECUTE FUNCTION map_sync_territory_geometry();

-- ---------------------------------------------------------------------------
-- RPCs (workspace-scoped)
-- ---------------------------------------------------------------------------

-- Same territory_type must not area-overlap within a workspace (edge touches OK)
-- SECURITY DEFINER must check membership (RLS does not apply inside DEFINER).
CREATE OR REPLACE FUNCTION check_map_territory_overlap(
  p_workspace_id UUID,
  p_geojson JSONB,
  p_territory_type TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  territory_type TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, t.territory_type
  FROM map_territories t
  WHERE t.workspace_id = p_workspace_id
    AND t.territory_type = p_territory_type
    AND t.status <> 'archived'
    AND (p_exclude_id IS NULL OR t.id <> p_exclude_id)
    AND ST_Intersects(
      t.geometry,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))::geography
    )
    AND NOT ST_Touches(
      t.geometry::geometry,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION map_stores_in_territory(p_territory_id UUID)
RETURNS SETOF map_stores AS $$
DECLARE
  v_ws UUID;
BEGIN
  SELECT t.workspace_id INTO v_ws FROM map_territories t WHERE t.id = p_territory_id;
  IF v_ws IS NULL THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL OR NOT is_workspace_member(v_ws, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.*
  FROM map_stores s
  JOIN map_territories t ON t.id = p_territory_id
  WHERE s.workspace_id = t.workspace_id
    AND s.location IS NOT NULL
    AND ST_Covers(t.geometry, s.location);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION map_stores_in_geojson(
  p_workspace_id UUID,
  p_geojson JSONB
)
RETURNS SETOF map_stores AS $$
DECLARE
  g geography;
BEGIN
  IF auth.uid() IS NULL OR NOT is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  g := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))::geography;
  RETURN QUERY
  SELECT s.*
  FROM map_stores s
  WHERE s.workspace_id = p_workspace_id
    AND s.location IS NOT NULL
    AND ST_Covers(g, s.location);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION search_map_stores(
  p_workspace_id UUID,
  p_query TEXT
)
RETURNS SETOF map_stores AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.*
  FROM map_stores s
  WHERE s.workspace_id = p_workspace_id
    AND (
      s.name ILIKE '%' || p_query || '%'
      OR s.store_number ILIKE '%' || p_query || '%'
      OR s.address ILIKE '%' || p_query || '%'
      OR s.city ILIKE '%' || p_query || '%'
    )
  ORDER BY s.name
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- ---------------------------------------------------------------------------
-- RLS: workspace members can CRUD
-- ---------------------------------------------------------------------------
ALTER TABLE map_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_territories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access map_stores" ON map_stores;
CREATE POLICY "Workspace members can access map_stores" ON map_stores
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access map_territories" ON map_territories;
CREATE POLICY "Workspace members can access map_territories" ON map_territories
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON map_stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON map_territories TO authenticated;
REVOKE ALL ON FUNCTION check_map_territory_overlap(UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION map_stores_in_territory(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION map_stores_in_geojson(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION search_map_stores(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_map_territory_overlap(UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION map_stores_in_territory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION map_stores_in_geojson(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION search_map_stores(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- PostGIS spatial_ref_sys: cannot enable RLS (owned by supabase_admin).
-- Block mutations so anon/authenticated cannot corrupt CRS reference data.
-- See supabase/fix-spatial-ref-sys-rls.sql and github.com/supabase/supabase/issues/47206
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_spatial_ref_sys_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'public.spatial_ref_sys is read-only (PostGIS reference data)';
END;
$$;

DROP TRIGGER IF EXISTS spatial_ref_sys_block_mutations ON public.spatial_ref_sys;
CREATE TRIGGER spatial_ref_sys_block_mutations
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.spatial_ref_sys
  FOR EACH ROW
  EXECUTE FUNCTION public.block_spatial_ref_sys_mutation();

DROP TRIGGER IF EXISTS spatial_ref_sys_block_truncate ON public.spatial_ref_sys;
CREATE TRIGGER spatial_ref_sys_block_truncate
  BEFORE TRUNCATE
  ON public.spatial_ref_sys
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.block_spatial_ref_sys_mutation();

NOTIFY pgrst, 'reload schema';
