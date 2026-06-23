-- Auth login audit log (platform admin visibility; service-role writes only)
CREATE TABLE IF NOT EXISTS auth_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL,
  auth_method TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_user_created
  ON auth_login_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_created
  ON auth_login_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_ip_created
  ON auth_login_events (ip_address, created_at DESC);

ALTER TABLE auth_login_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE auth_login_events IS
  'Platform auth audit trail: sign-in, dual-auth, and sign-out events with IP and timestamp.';

NOTIFY pgrst, 'reload schema';