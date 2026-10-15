-- SUPERSEDED 2026-10-15. Do not apply.
-- Map, Health, and notebook Investments/Customers/Competitors were removed from the app.
-- Applying this file would recreate objects the application no longer uses.
-- Live tables are intentionally left in place; dropping them is a separate approval.
-- The original statements remain below this guard for a future rollback only.
DO $$
BEGIN
  RAISE EXCEPTION 'superseded script: do not apply. See supabase/archive/removed-features/README.md';
END
$$;

-- Stress readings are private to the person who logged them.
-- Other workspace members can still see weight / vitals / activity.

DROP POLICY IF EXISTS "Workspace members can access health_readings" ON health_readings;

CREATE POLICY "Workspace members can access health_readings" ON health_readings
  FOR ALL
  USING (
    is_workspace_member(workspace_id, auth.uid())
    AND (metric_type <> 'stress' OR user_id = auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
    AND (metric_type <> 'stress' OR user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
