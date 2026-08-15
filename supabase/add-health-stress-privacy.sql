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
