-- Obsolete workaround. Public.spatial_ref_sys cannot have RLS enabled because
-- it is owned by supabase_admin (https://github.com/supabase/supabase/issues/47206).
--
-- The actual fix is to install PostGIS in the extensions schema so the table
-- is not exposed by the Data API or Security Advisor:
--   node scripts/apply-supabase-sql.mjs supabase/move-postgis-to-extensions.sql
--
-- This file now only verifies that public.spatial_ref_sys is gone.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'spatial_ref_sys'
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION
      'public.spatial_ref_sys still exists. Apply supabase/move-postgis-to-extensions.sql';
  END IF;
END
$$;
