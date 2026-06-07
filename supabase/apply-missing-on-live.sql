-- ============================================
-- Apply ONLY what is missing on project emsvqyaolltalqgppbxr
-- (audited 2026-06-07 via REST schema probe)
-- Safe to re-run.
-- ============================================

-- Platform admin: pause accounts
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_at TIMESTAMPTZ;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_reason TEXT;

COMMENT ON COLUMN profiles.access_paused IS 'When true, user is banned from auth and cannot use the app.';

-- Dual authentication challenges (server-managed OTP; no client RLS policies)
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

COMMENT ON TABLE dual_auth_challenges IS 'Short-lived hashed email OTP codes for dual authentication at sign-in.';

NOTIFY pgrst, 'reload schema';