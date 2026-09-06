-- ============================================
-- Grok MCP connector OAuth tickets
-- One-time-use authorization codes and refresh tokens.
-- Managed only by the service role (no client RLS policies).
-- ============================================

CREATE TABLE IF NOT EXISTS mcp_oauth_jtis (
  jti UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('auth_code', 'refresh_token')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_jtis_user
  ON mcp_oauth_jtis (user_id);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_jtis_expires
  ON mcp_oauth_jtis (expires_at);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_jtis_active
  ON mcp_oauth_jtis (kind, consumed_at)
  WHERE consumed_at IS NULL;

ALTER TABLE mcp_oauth_jtis ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE mcp_oauth_jtis IS
  'Replay protection for Grok MCP OAuth authorization codes and refresh tokens. Service role only.';
