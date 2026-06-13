-- Pending flag for checklist rows (parked items hidden from the active list)
-- Run in Supabase SQL Editor (idempotent)

ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_list_items_list_pending
  ON list_items (list_id, pending)
  WHERE pending = TRUE;

COMMENT ON COLUMN list_items.pending IS
  'When true, item is parked in the pending bucket instead of the active checklist.';

NOTIFY pgrst, 'reload schema';