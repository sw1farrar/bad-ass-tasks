-- Platform admin: pause user access without deleting their account.
-- Run in Supabase SQL editor. Safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_reason TEXT;

COMMENT ON COLUMN profiles.access_paused IS 'When true, user is banned from auth and cannot use the app.';