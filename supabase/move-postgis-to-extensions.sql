-- ============================================================================
-- Relocate PostGIS from public → extensions
-- ============================================================================
-- Why:
--   Enabling PostGIS in public creates public.spatial_ref_sys without RLS.
--   That table is owned by supabase_admin, so we cannot:
--     ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--     ALTER TABLE ... OWNER TO postgres
--     REVOKE the supabase_admin grants from anon/authenticated (partial)
--   Security Advisor lint rls_disabled_in_public then emails project owners
--   weekly (critical: "Table publicly accessible").
--
-- Fix:
--   Drop PostGIS and reinstall it in the extensions schema (not exposed by
--   PostgREST: db_schema = public,graphql_public). spatial_ref_sys leaves
--   the Data API. Map geography columns and RPCs are recreated.
--
-- Safe because:
--   map_stores / map_territories spatial payloads are snapshotted as EWKT
--   before the drop and restored after. (Live row counts were 0 when this
--   was first applied.)
--
-- Apply:
--   node scripts/apply-supabase-sql.mjs supabase/move-postgis-to-extensions.sql
-- ============================================================================

BEGIN;

-- Snapshot spatial payloads as text so CASCADE can drop geography columns.
CREATE TEMP TABLE _bat_map_stores_geo ON COMMIT DROP AS
SELECT id,
       CASE
         WHEN location IS NOT NULL THEN ST_AsEWKT(location::geometry)
         ELSE NULL
       END AS loc_ewkt
FROM public.map_stores;

CREATE TEMP TABLE _bat_map_territories_geo ON COMMIT DROP AS
SELECT id,
       CASE
         WHEN geometry IS NOT NULL THEN ST_AsEWKT(geometry::geometry)
         ELSE NULL
       END AS geom_ewkt
FROM public.map_territories;

-- Do not DROP TRIGGER on spatial_ref_sys: that table is owned by
-- supabase_admin and DROP TRIGGER requires ownership. CASCADE below
-- removes those workaround triggers with the extension.

-- Map sync triggers reference PostGIS types in their bodies; drop before CASCADE
-- so recreation is deterministic.
DROP TRIGGER IF EXISTS map_stores_sync_location ON public.map_stores;
DROP TRIGGER IF EXISTS map_territories_sync_geometry ON public.map_territories;
DROP FUNCTION IF EXISTS public.map_sync_store_location();
DROP FUNCTION IF EXISTS public.map_sync_territory_geometry();

DROP EXTENSION IF EXISTS postgis CASCADE;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION postgis WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Leftover from the public.spatial_ref_sys write-block workaround
DROP FUNCTION IF EXISTS public.block_spatial_ref_sys_mutation();

-- Recreate geography columns
ALTER TABLE public.map_stores
  ADD COLUMN IF NOT EXISTS location extensions.geography(POINT, 4326);

ALTER TABLE public.map_territories
  ADD COLUMN IF NOT EXISTS geometry extensions.geography(MULTIPOLYGON, 4326);

UPDATE public.map_stores m
SET location = extensions.ST_GeogFromText(t.loc_ewkt)
FROM _bat_map_stores_geo t
WHERE m.id = t.id
  AND t.loc_ewkt IS NOT NULL;

UPDATE public.map_territories m
SET geometry = extensions.ST_GeogFromText(t.geom_ewkt)
FROM _bat_map_territories_geo t
WHERE m.id = t.id
  AND t.geom_ewkt IS NOT NULL;

-- Restore NOT NULL on territories.geometry when every row has a value
-- (true for an empty table and after a complete restore).
DO $nn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.map_territories WHERE geometry IS NULL
  ) THEN
    ALTER TABLE public.map_territories
      ALTER COLUMN geometry SET NOT NULL;
  END IF;
END
$nn$;

CREATE INDEX IF NOT EXISTS idx_map_stores_location
  ON public.map_stores USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_map_territories_geometry
  ON public.map_territories USING GIST (geometry);

-- ---------------------------------------------------------------------------
-- Triggers (search_path includes extensions so ST_* resolve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.map_sync_store_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $fn$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS map_stores_sync_location ON public.map_stores;
CREATE TRIGGER map_stores_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.map_stores
  FOR EACH ROW EXECUTE FUNCTION public.map_sync_store_location();

CREATE OR REPLACE FUNCTION public.map_sync_territory_geometry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $fn$
BEGIN
  NEW.geometry = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(NEW.geojson::text), 4326))::geography;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS map_territories_sync_geometry ON public.map_territories;
CREATE TRIGGER map_territories_sync_geometry
  BEFORE INSERT OR UPDATE OF geojson ON public.map_territories
  FOR EACH ROW EXECUTE FUNCTION public.map_sync_territory_geometry();

-- ---------------------------------------------------------------------------
-- Map RPCs — membership checks + search_path includes extensions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_map_territory_overlap(
  p_workspace_id UUID,
  p_geojson JSONB,
  p_territory_type TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  territory_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.map_stores_in_territory(p_territory_id UUID)
RETURNS SETOF map_stores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_ws UUID;
BEGIN
  SELECT t.workspace_id INTO v_ws
  FROM map_territories t
  WHERE t.id = p_territory_id;

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
$fn$;

CREATE OR REPLACE FUNCTION public.map_stores_in_geojson(
  p_workspace_id UUID,
  p_geojson JSONB
)
RETURNS SETOF map_stores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.search_map_stores(
  p_workspace_id UUID,
  p_query TEXT
)
RETURNS SETOF map_stores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.check_map_territory_overlap(UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.map_stores_in_territory(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.map_stores_in_geojson(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_map_stores(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_map_territory_overlap(UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_stores_in_territory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_stores_in_geojson(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_map_stores(UUID, TEXT) TO authenticated;

-- If we now own spatial_ref_sys, lock it down even though it is not in the API schema.
DO $rls$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'extensions'
      AND c.relname = 'spatial_ref_sys'
      AND r.rolname = current_user
  ) THEN
    EXECUTE 'ALTER TABLE extensions.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$
      DROP POLICY IF EXISTS spatial_ref_sys_select ON extensions.spatial_ref_sys
    $p$;
    EXECUTE $p$
      CREATE POLICY spatial_ref_sys_select ON extensions.spatial_ref_sys
        FOR SELECT TO public
        USING (true)
    $p$;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END
$rls$;

NOTIFY pgrst, 'reload schema';

COMMIT;
