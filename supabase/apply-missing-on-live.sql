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

-- Atomic dual-auth challenge creation (prevents duplicate codes under concurrent requests)
CREATE OR REPLACE FUNCTION public.create_dual_auth_challenge_atomic(
  p_user_id UUID,
  p_code_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent RECORD;
  v_count INT;
  v_window_start TIMESTAMPTZ := NOW() - INTERVAL '10 minutes';
  v_idempotency INTERVAL := INTERVAL '2 minutes';
  v_cooldown INTERVAL := INTERVAL '60 seconds';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT id, created_at
  INTO v_recent
  FROM dual_auth_challenges
  WHERE user_id = p_user_id
    AND consumed_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent.id IS NOT NULL THEN
    IF NOT p_force AND v_recent.created_at > NOW() - v_idempotency THEN
      RETURN jsonb_build_object(
        'action', 'already_sent',
        'retry_after_seconds',
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_recent.created_at + v_cooldown - NOW())))::INT)
      );
    END IF;

    IF p_force AND v_recent.created_at > NOW() - v_cooldown THEN
      RETURN jsonb_build_object(
        'action', 'cooldown',
        'retry_after_seconds',
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_recent.created_at + v_cooldown - NOW())))::INT)
      );
    END IF;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_count
  FROM dual_auth_challenges
  WHERE user_id = p_user_id
    AND created_at >= v_window_start
    AND consumed_at IS NULL;

  IF v_count >= 3 THEN
    RETURN jsonb_build_object('action', 'rate_limited');
  END IF;

  UPDATE dual_auth_challenges
  SET consumed_at = NOW()
  WHERE user_id = p_user_id
    AND consumed_at IS NULL
    AND expires_at > NOW();

  INSERT INTO dual_auth_challenges (user_id, code_hash, expires_at)
  VALUES (p_user_id, p_code_hash, p_expires_at);

  RETURN jsonb_build_object('action', 'send');
END;
$$;

REVOKE ALL ON FUNCTION public.create_dual_auth_challenge_atomic(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dual_auth_challenge_atomic(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;

NOTIFY pgrst, 'reload schema';