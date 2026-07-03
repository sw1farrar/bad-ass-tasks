-- Health tracking: time-series readings + per-user goals (workspace-shared)
-- Run in Supabase SQL editor after base schema is applied.

CREATE TABLE IF NOT EXISTS health_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_readings_workspace_metric_recorded
  ON health_readings(workspace_id, metric_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_readings_workspace_user_recorded
  ON health_readings(workspace_id, user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS health_profiles (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm NUMERIC,
  weight_goal NUMERIC,
  weight_unit TEXT DEFAULT 'lb',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE health_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access health_readings" ON health_readings;
CREATE POLICY "Workspace members can access health_readings" ON health_readings
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access health_profiles" ON health_profiles;
CREATE POLICY "Workspace members can access health_profiles" ON health_profiles
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

NOTIFY pgrst, 'reload schema';