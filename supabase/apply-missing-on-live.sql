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

-- AI review suggestions (pending_review queue pre-fill)
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS ai_suggestion JSONB;

COMMENT ON COLUMN notes.ai_suggestion IS
  'Ephemeral AI filing suggestion for pending_review notes. Cleared on reject or after filing.';

-- Auth login audit log (platform admin; service-role writes only)
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

-- Workspace Notes (notebooks) — see supabase/add-notebooks.sql for full definition
CREATE TABLE IF NOT EXISTS notebooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebooks_workspace ON notebooks(workspace_id);

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS notebook_id UUID;

ALTER TABLE notes
  DROP CONSTRAINT IF EXISTS notes_notebook_id_fkey;

ALTER TABLE notes
  ADD CONSTRAINT notes_notebook_id_fkey
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id) WHERE notebook_id IS NOT NULL;

ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access notebooks" ON notebooks;
CREATE POLICY "Workspace members can access notebooks" ON notebooks
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_notebooks_updated_at ON notebooks;
CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Receipt line items ledger (AI extraction) — see supabase/add-workspace-receipt-items.sql
CREATE TABLE IF NOT EXISTS workspace_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  transaction_date DATE,
  vendor TEXT NOT NULL DEFAULT '',
  item_name TEXT NOT NULL,
  item_category TEXT,
  price_paid NUMERIC(12, 2),
  warranty TEXT,
  return_policy TEXT,
  dedupe_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_receipt_items_dedupe UNIQUE (workspace_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_workspace_date
  ON workspace_receipt_items (workspace_id, transaction_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_receipt_items_workspace_vendor
  ON workspace_receipt_items (workspace_id, vendor);

CREATE INDEX IF NOT EXISTS idx_receipt_items_workspace_category
  ON workspace_receipt_items (workspace_id, item_category);

CREATE INDEX IF NOT EXISTS idx_receipt_items_note
  ON workspace_receipt_items (note_id);

COMMENT ON TABLE workspace_receipt_items IS 'Line items extracted from receipt documents during AI analysis.';
COMMENT ON COLUMN workspace_receipt_items.dedupe_key IS 'Stable hash key: note_id + item + price + date — prevents duplicate logging.';

ALTER TABLE workspace_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access receipt items" ON workspace_receipt_items;
CREATE POLICY "Workspace members can access receipt items" ON workspace_receipt_items
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

NOTIFY pgrst, 'reload schema';