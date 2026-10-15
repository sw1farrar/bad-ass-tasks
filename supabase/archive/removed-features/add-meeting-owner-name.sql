-- SUPERSEDED 2026-10-15. Do not apply.
-- Meetings were removed from the app.
-- Applying this file would recreate objects the application no longer uses.
-- Live tables are intentionally left in place; dropping them is a separate approval.
-- The original statements remain below this guard for a future rollback only.
DO $$
BEGIN
  RAISE EXCEPTION 'superseded script: do not apply. See supabase/archive/removed-features/README.md';
END
$$;

-- Free-text responsible name on agenda topics (in addition to optional owner_id member link)
ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

NOTIFY pgrst, 'reload schema';