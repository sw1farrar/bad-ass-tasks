-- Harden PostGIS system table flagged by Supabase Security Advisor
-- (rls_disabled_in_public on public.spatial_ref_sys)
--
-- Context
-- -------
-- Enabling PostGIS creates public.spatial_ref_sys (EPSG / CRS reference data).
-- Supabase Security Advisor flags it as Critical because RLS is off and
-- anon/authenticated have full grants from extension install.
--
-- Constraint
-- ----------
-- The table is owned by supabase_admin. Project roles (postgres) cannot:
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--   ALTER TABLE ... OWNER TO ...
--   REVOKE privileges granted by supabase_admin
-- This is a known platform limitation:
--   https://github.com/supabase/supabase/issues/47206
--
-- What we can do
-- --------------
-- postgres has TRIGGER privilege on the table, so we install write-blocking
-- triggers. That stops API/SQL mutation of CRS data even without RLS.
-- SELECT remains allowed (public reference data; map RPCs still work).
--
-- NOTE: The Security Advisor email may continue until Supabase excludes this
-- table from the lint or enables RLS as extension owner. Your *app* tables
-- already have RLS — audit confirmed only spatial_ref_sys is missing it.
--
-- Apply: node scripts/apply-supabase-sql.mjs supabase/fix-spatial-ref-sys-rls.sql

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

-- Attempt RLS (will fail with "must be owner" on current Supabase; kept for
-- when platform ownership changes). Safe to leave commented.
-- ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
