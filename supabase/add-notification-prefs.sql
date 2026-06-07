-- Notification preferences on profiles (idempotent)
-- Safe to run on live projects that predate Agent 31 notifications.
-- Copy/paste the full statement below — do not use placeholder text like {...}

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{"email": true, "inApp": true, "types": {"mention": true, "comment": true, "invite": true, "assignment": true, "deadline": true, "activity": true}, "perWorkspace": {}}'::jsonb;

COMMENT ON COLUMN profiles.notification_prefs IS
  'Per-user notification delivery prefs: global email/inApp toggles, per-type switches, optional per-workspace overrides.';

NOTIFY pgrst, 'reload schema';