-- One-time: enable live profile name/handle updates for teammates.
-- Run in Supabase SQL Editor if member names don't appear on other clients until refresh.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;

-- Teammates must be able to read profile rows (name, handle, avatar).
-- Safe to re-run; skips if the policy already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Workspace members can view basic profiles of teammates'
  ) THEN
    CREATE POLICY "Workspace members can view basic profiles of teammates" ON profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM workspace_members wm1
          JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
          WHERE wm1.user_id = auth.uid()
            AND wm2.user_id = profiles.id
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';