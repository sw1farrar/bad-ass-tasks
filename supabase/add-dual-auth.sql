-- ============================================
-- Dual authentication (email OTP + trusted device)
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS dual_auth_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dual_auth_challenges_user_active
  ON dual_auth_challenges (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE dual_auth_challenges ENABLE ROW LEVEL SECURITY;

-- No client policies: challenges are managed server-side via service role only.

COMMENT ON TABLE dual_auth_challenges IS 'Short-lived hashed email OTP codes for dual authentication at sign-in.';