-- Auto-enable RLS on new tables created in public.
-- Skips tables we cannot ALTER (extension-owned).
-- Prevents a repeat of rls_disabled_in_public advisor emails for app tables.
--
-- Apply: node scripts/apply-supabase-sql.mjs supabase/auto-enable-rls-on-new-tables.sql

CREATE OR REPLACE FUNCTION public.enable_rls_on_new_public_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT object_identity, schema_name
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
      AND object_type IN ('table', 'partitioned table')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
      WHEN undefined_table THEN
        NULL;
    END;
  END LOOP;
END;
$fn$;

DROP EVENT TRIGGER IF EXISTS enable_rls_on_new_public_tables;
CREATE EVENT TRIGGER enable_rls_on_new_public_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.enable_rls_on_new_public_tables();
