-- ============================================================================
-- Security hardening — consensus from multi-agent audit (2026-08)
-- Idempotent. Apply:
--   node scripts/apply-supabase-sql.mjs supabase/security-hardening-consensus-2026-08.sql
--
-- Fixes:
--   1) Map SECURITY DEFINER RPCs — membership checks + REVOKE PUBLIC
--   2) create_workspace_for_user — bind to auth.uid()
--   3) create_workspace_invite — ban owner role; admin cannot invite admin
--   4) accept_workspace_invite — no role upgrade on re-accept; reject owner invites
--   5) update_member_role — ban owner promotion; admin scope limits
--   6) workspace_members DELETE — protect owners / last owner
--   7) profiles — lock access_paused* from self-update
--   8) search_users_for_invite — require owner/admin + min length 2
--   9) list-share — NULL-safe accept/decline; presentation column guard
--  10) note_attachments — storage_path must stay under workspace_id
--  11) cleanup_orphan_invite_notifications — service_role only
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Map RPCs: membership before any cross-tenant read
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_map_territory_overlap(
  p_workspace_id UUID,
  p_geojson JSONB,
  p_territory_type TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  territory_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, t.territory_type
  FROM map_territories t
  WHERE t.workspace_id = p_workspace_id
    AND t.territory_type = p_territory_type
    AND t.status <> 'archived'
    AND (p_exclude_id IS NULL OR t.id <> p_exclude_id)
    AND ST_Intersects(
      t.geometry,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))::geography
    )
    AND NOT ST_Touches(
      t.geometry::geometry,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))
    );
END;
$$;

CREATE OR REPLACE FUNCTION map_stores_in_territory(p_territory_id UUID)
RETURNS SETOF map_stores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ws UUID;
BEGIN
  SELECT t.workspace_id INTO v_ws
  FROM map_territories t
  WHERE t.id = p_territory_id;

  IF v_ws IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR NOT is_workspace_member(v_ws, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.*
  FROM map_stores s
  JOIN map_territories t ON t.id = p_territory_id
  WHERE s.workspace_id = t.workspace_id
    AND s.location IS NOT NULL
    AND ST_Covers(t.geometry, s.location);
END;
$$;

CREATE OR REPLACE FUNCTION map_stores_in_geojson(
  p_workspace_id UUID,
  p_geojson JSONB
)
RETURNS SETOF map_stores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  g geography;
BEGIN
  IF auth.uid() IS NULL OR NOT is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  g := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))::geography;
  RETURN QUERY
  SELECT s.*
  FROM map_stores s
  WHERE s.workspace_id = p_workspace_id
    AND s.location IS NOT NULL
    AND ST_Covers(g, s.location);
END;
$$;

CREATE OR REPLACE FUNCTION search_map_stores(
  p_workspace_id UUID,
  p_query TEXT
)
RETURNS SETOF map_stores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.*
  FROM map_stores s
  WHERE s.workspace_id = p_workspace_id
    AND (
      s.name ILIKE '%' || p_query || '%'
      OR s.store_number ILIKE '%' || p_query || '%'
      OR s.address ILIKE '%' || p_query || '%'
      OR s.city ILIKE '%' || p_query || '%'
    )
  ORDER BY s.name
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION check_map_territory_overlap(UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION map_stores_in_territory(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION map_stores_in_geojson(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION search_map_stores(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION check_map_territory_overlap(UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION map_stores_in_territory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION map_stores_in_geojson(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION search_map_stores(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) create_workspace_for_user: only for self
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_workspace_for_user(
  user_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM user_id THEN
    RAISE EXCEPTION 'Not authorized to create workspace for this user';
  END IF;

  INSERT INTO profiles (id, full_name, email)
  SELECT user_id, raw_user_meta_data->>'full_name', email
  FROM auth.users WHERE id = user_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO workspaces (name, slug, owner_id)
  VALUES (workspace_name, workspace_slug, user_id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, user_id, 'owner');

  RETURN new_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION create_workspace_for_user(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace_for_user(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) create_workspace_invite: no owner invites; admin cannot invite admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_workspace_invite(
  p_workspace_id UUID,
  p_email TEXT DEFAULT NULL,
  p_role user_role DEFAULT 'user'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id UUID;
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions: only workspace owners and admins may send invites';
  END IF;

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite as owner; use transfer ownership';
  END IF;

  IF p_role = 'admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners may invite admins';
  END IF;

  INSERT INTO workspace_invites (workspace_id, email, role, invited_by)
  VALUES (p_workspace_id, p_email, p_role, auth.uid())
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

REVOKE ALL ON FUNCTION create_workspace_invite(UUID, TEXT, user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace_invite(UUID, TEXT, user_role) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) accept_workspace_invite: reject owner invites; no role upgrade
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION accept_workspace_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_ws_id UUID;
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE id = p_invite_id
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, already accepted, or expired';
  END IF;

  IF v_invite.role = 'owner' THEN
    RAISE EXCEPTION 'Invalid invite role';
  END IF;

  IF v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This invite was sent to a different user';
  END IF;

  IF v_invite.email IS NOT NULL AND (
    v_caller_email IS NULL OR lower(v_caller_email) <> lower(v_invite.email)
  ) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  INSERT INTO profiles (id, email)
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email);

  v_ws_id := v_invite.workspace_id;

  -- Never elevate an existing member via re-accept
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_ws_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invites SET accepted_at = NOW() WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'invite'
    AND (metadata->>'invite_id')::uuid = p_invite_id;

  RETURN v_ws_id;
END;
$$;

REVOKE ALL ON FUNCTION accept_workspace_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_workspace_invite(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) update_member_role: no owner via this path; admin cannot touch owner/admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_member_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_new_role user_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_target_role user_role;
  v_owner_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_new_role = 'owner' THEN
    RAISE EXCEPTION 'Use transfer_workspace_ownership to assign owner';
  END IF;

  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_target_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  LIMIT 1;

  IF v_target_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_caller_role = 'admin' THEN
    IF v_target_role IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Admins cannot change owner or admin roles';
    END IF;
    IF p_new_role = 'admin' THEN
      RAISE EXCEPTION 'Only owners may grant admin';
    END IF;
  END IF;

  IF v_target_role = 'owner' AND p_new_role <> 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM workspace_members
    WHERE workspace_id = p_workspace_id AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RETURN FALSE;
    END IF;
  END IF;

  UPDATE workspace_members
  SET role = p_new_role
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION update_member_role(UUID, UUID, user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_member_role(UUID, UUID, user_role) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) workspace_members DELETE policy: protect owners
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owners and admins can remove members" ON workspace_members;
CREATE POLICY "Owners and admins can remove members" ON workspace_members
  FOR DELETE USING (
    workspace_members.user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
    AND (
      -- Admins may only remove regular members
      (
        workspace_members.role NOT IN ('owner', 'admin')
        AND EXISTS (
          SELECT 1 FROM workspace_members c
          WHERE c.workspace_id = workspace_members.workspace_id
            AND c.user_id = auth.uid()
            AND c.role IN ('owner', 'admin')
        )
      )
      OR
      -- Only owners may remove admins (not other owners via this path)
      (
        workspace_members.role = 'admin'
        AND EXISTS (
          SELECT 1 FROM workspace_members c
          WHERE c.workspace_id = workspace_members.workspace_id
            AND c.user_id = auth.uid()
            AND c.role = 'owner'
        )
      )
      OR
      -- Owners may remove other owners only when more than one owner exists
      (
        workspace_members.role = 'owner'
        AND EXISTS (
          SELECT 1 FROM workspace_members c
          WHERE c.workspace_id = workspace_members.workspace_id
            AND c.user_id = auth.uid()
            AND c.role = 'owner'
        )
        AND (
          SELECT COUNT(*) FROM workspace_members o
          WHERE o.workspace_id = workspace_members.workspace_id
            AND o.role = 'owner'
        ) > 1
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7) profiles: freeze access_paused* for non-service-role clients
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.access_paused IS DISTINCT FROM OLD.access_paused
       OR NEW.access_paused_at IS DISTINCT FROM OLD.access_paused_at
       OR NEW.access_paused_reason IS DISTINCT FROM OLD.access_paused_reason THEN
      -- service_role bypasses RLS but still fires triggers; allow JWT role service_role
      IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
         AND current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
        -- Also allow postgres during SQL editor maintenance
        IF session_user NOT IN ('postgres', 'supabase_admin') THEN
          RAISE EXCEPTION 'Cannot modify access_paused fields';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_admin_fields ON profiles;
CREATE TRIGGER profiles_protect_admin_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_admin_fields();

-- ---------------------------------------------------------------------------
-- 8) search_users_for_invite: owner/admin of workspace + min length 2
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION search_users_for_invite(
  search_term TEXT,
  exclude_workspace_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  username TEXT,
  location TEXT,
  email TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  term TEXT := lower(trim(coalesce(search_term, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF length(term) < 2 THEN
    RETURN;
  END IF;

  -- Require a workspace context and owner/admin role there
  IF exclude_workspace_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = exclude_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.username,
    p.location,
    p.email,
    p.avatar_url
  FROM profiles p
  WHERE p.id <> auth.uid()
    AND (
      lower(coalesce(p.full_name, '')) ILIKE '%' || term || '%'
      OR lower(coalesce(p.username, '')) ILIKE '%' || term || '%'
      OR lower(coalesce(p.location, '')) ILIKE '%' || term || '%'
      OR lower(coalesce(p.email, '')) ILIKE '%' || term || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = p.id
        AND wm.workspace_id = exclude_workspace_id
    )
  ORDER BY
    CASE
      WHEN lower(coalesce(p.username, '')) = term THEN 0
      WHEN lower(coalesce(p.username, '')) ILIKE term || '%' THEN 1
      WHEN lower(coalesce(p.full_name, '')) ILIKE term || '%' THEN 2
      ELSE 3
    END,
    coalesce(p.full_name, p.username, p.email, '')
  LIMIT 15;
END;
$$;

REVOKE ALL ON FUNCTION search_users_for_invite(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_users_for_invite(TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9a) list-share accept/decline/get: NULL-safe recipient auth
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION accept_list_share_invite(
  p_invite_id UUID,
  p_target_workspace_id UUID
)
RETURNS TABLE (list_id UUID, target_workspace_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_caller_email TEXT;
  v_share_id UUID;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite
  FROM list_share_invites
  WHERE id = p_invite_id
    AND declined_at IS NULL
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share invite not found, declined, revoked, or expired';
  END IF;

  IF NOT (
    (v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id = auth.uid())
    OR (
      v_invite.recipient_email IS NOT NULL
      AND v_caller_email IS NOT NULL
      AND lower(v_caller_email) = lower(v_invite.recipient_email)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to accept this share';
  END IF;

  IF NOT is_workspace_member(p_target_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of the selected workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM workspace_list_shares
    WHERE list_id = v_invite.list_id
      AND target_workspace_id = p_target_workspace_id
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This list is already shared into that workspace';
  END IF;

  INSERT INTO profiles (id, email)
  SELECT u.id, u.email FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, profiles.email);

  INSERT INTO workspace_list_shares (
    list_id,
    source_workspace_id,
    target_workspace_id,
    shared_by,
    accepted_by,
    invite_id,
    permission
  )
  VALUES (
    v_invite.list_id,
    v_invite.source_workspace_id,
    p_target_workspace_id,
    v_invite.invited_by,
    auth.uid(),
    p_invite_id,
    v_invite.permission
  )
  RETURNING id INTO v_share_id;

  UPDATE list_share_invites
  SET accepted_at = COALESCE(accepted_at, NOW())
  WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'list_share'
    AND (metadata->>'list_share_id')::uuid = p_invite_id;

  RETURN QUERY SELECT v_invite.list_id, p_target_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION decline_list_share_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite FROM list_share_invites WHERE id = p_invite_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF NOT (
    (v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id = auth.uid())
    OR (
      v_invite.recipient_email IS NOT NULL
      AND v_caller_email IS NOT NULL
      AND lower(v_caller_email) = lower(v_invite.recipient_email)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to decline this share';
  END IF;

  UPDATE list_share_invites SET declined_at = NOW() WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'list_share'
    AND (metadata->>'list_share_id')::uuid = p_invite_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION get_list_share_linked_workspaces(p_invite_id UUID)
RETURNS TABLE (workspace_id UUID, workspace_name TEXT, already_linked BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite FROM list_share_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT (
    (v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id = auth.uid())
    OR (
      v_invite.recipient_email IS NOT NULL
      AND v_caller_email IS NOT NULL
      AND lower(v_caller_email) = lower(v_invite.recipient_email)
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    w.id AS workspace_id,
    w.name AS workspace_name,
    EXISTS (
      SELECT 1 FROM workspace_list_shares s
      WHERE s.list_id = v_invite.list_id
        AND s.target_workspace_id = w.id
        AND s.revoked_at IS NULL
    ) AS already_linked
  FROM workspace_members wm
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid()
  ORDER BY w.name ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9b) list-share column guards (presentation-only for target; decline-only for recipient)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION protect_workspace_list_share_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.list_id IS DISTINCT FROM OLD.list_id
       OR NEW.source_workspace_id IS DISTINCT FROM OLD.source_workspace_id
       OR NEW.target_workspace_id IS DISTINCT FROM OLD.target_workspace_id
       OR NEW.permission IS DISTINCT FROM OLD.permission
       OR NEW.shared_by IS DISTINCT FROM OLD.shared_by
       OR NEW.invite_id IS DISTINCT FROM OLD.invite_id THEN
      -- Source owner/admin may still change grant fields
      IF NOT EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = OLD.source_workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
      ) THEN
        RAISE EXCEPTION 'Cannot modify list share grant fields';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_list_shares_protect_columns ON workspace_list_shares;
CREATE TRIGGER workspace_list_shares_protect_columns
  BEFORE UPDATE ON workspace_list_shares
  FOR EACH ROW
  EXECUTE FUNCTION protect_workspace_list_share_columns();

CREATE OR REPLACE FUNCTION protect_list_share_invite_recipient_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Source admins may manage freely
    IF EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = OLD.source_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    ) THEN
      RETURN NEW;
    END IF;

    -- Recipients may only set declined_at (and not change grant fields)
    IF NEW.permission IS DISTINCT FROM OLD.permission
       OR NEW.list_id IS DISTINCT FROM OLD.list_id
       OR NEW.source_workspace_id IS DISTINCT FROM OLD.source_workspace_id
       OR NEW.invited_user_id IS DISTINCT FROM OLD.invited_user_id
       OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
       OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'Recipients may only decline list share invites';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS list_share_invites_protect_recipient ON list_share_invites;
CREATE TRIGGER list_share_invites_protect_recipient
  BEFORE UPDATE ON list_share_invites
  FOR EACH ROW
  EXECUTE FUNCTION protect_list_share_invite_recipient_columns();

-- ---------------------------------------------------------------------------
-- 10) note_attachments storage_path integrity
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION note_attachments_storage_path_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.storage_path IS NULL
     OR position('..' in NEW.storage_path) > 0
     OR NEW.storage_path NOT LIKE (NEW.workspace_id::text || '/%') THEN
    RAISE EXCEPTION 'invalid storage_path';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.storage_path IS DISTINCT FROM OLD.storage_path
     AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'storage_path is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_note_attachments_storage_path ON note_attachments;
CREATE TRIGGER trg_note_attachments_storage_path
  BEFORE INSERT OR UPDATE ON note_attachments
  FOR EACH ROW
  EXECUTE FUNCTION note_attachments_storage_path_guard();

-- Prefer SELECT-only for authenticated clients; writes go through service role APIs
DROP POLICY IF EXISTS "Workspace members can access note attachments" ON note_attachments;
DROP POLICY IF EXISTS "note_attachments_select" ON note_attachments;
CREATE POLICY "note_attachments_select" ON note_attachments
  FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 11) cleanup_orphan_invite_notifications — service_role only (if present)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_orphan_invite_notifications'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.cleanup_orphan_invite_notifications() FROM PUBLIC, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_orphan_invite_notifications() TO service_role';
  END IF;
END $$;

-- Storage: remove client-side storage policies for note-attachments (service role only)
DROP POLICY IF EXISTS "Workspace members read note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members upload note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members delete note attachments" ON storage.objects;

NOTIFY pgrst, 'reload schema';
