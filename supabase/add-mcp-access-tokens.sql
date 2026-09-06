-- ============================================
-- Personal access tokens for MCP hosts that cannot
-- complete the Grok.com OAuth browser flow.
-- The grok.com connector continues to use OAuth JWTs.
-- Service role only — no client RLS policies.
-- ============================================

CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_user_active
  ON mcp_access_tokens (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE mcp_access_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE mcp_access_tokens IS
  'Hashed personal access tokens for MCP bots. Grok.com OAuth tokens are separate.';
