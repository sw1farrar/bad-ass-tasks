-- SUPERSEDED 2026-10-15. Do not apply.
-- Map, Health, and notebook Investments/Customers/Competitors were removed from the app.
-- Applying this file would recreate objects the application no longer uses.
-- Live tables are intentionally left in place; dropping them is a separate approval.
-- The original statements remain below this guard for a future rollback only.
DO $$
BEGIN
  RAISE EXCEPTION 'superseded script: do not apply. See supabase/archive/removed-features/README.md';
END
$$;

-- Allow notebook investments to be checked off / completed.

ALTER TABLE notebook_investments
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notebook_investments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notebook_investments_workspace_open
  ON notebook_investments (workspace_id, completed)
  WHERE completed = FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notebook_investments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notebook_investments;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
